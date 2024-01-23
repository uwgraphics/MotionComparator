import React, { Component, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotJoint } from "../../objects3D/RobotJoint";
import { RobotLink } from "../../objects3D/RobotLink";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { newID, processProperties } from "../../helpers";
import { LineGraph } from "../LineGraph";
// import { color } from "d3";
import { Quaternion, Vector3 } from "three";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { DragButton } from "../DragButton";
import { Graph } from "../../objects3D/Graph";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
// import { time } from "console";
//TODO timewarped positions graph
export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    // robotScene: RobotScene,
    getParentDockLayout: () => DockLayout | undefined,
    is_part_changed: Map<string, number>, //id name to old index in times/values, if -1, then it's new line and need line generation(data and graph)
    eventName:string[],
    add:boolean,
    filter_prop: number,
    force_update: boolean,
    graph: Graph,
    setGraphOptionPanelActive: () => void,
}

interface graph_panel_state {
    counter:number,
    diff_times: number[][],
    diff_values: number[][],
    prev_times: time_obj, //previous "current times" used for componentDidUpdate
    use_timeWarp: boolean, // whether to use timewarped data instead of raw data
    line_ids: string[], //list of names of lines graphed
    line_names_diff: string[], //list of names of lines graphed in diff graph
    color_map: Map<string, string>, //map line name to color
    currObjects: string[], // an array of current objects, i.e. Scene4.id#sawyer&right_j0 
    
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    need_update: boolean // need to update graph data to trigger fillGraphData
    graph_update: boolean // need to update graph->sent to LineGraph components when lines are added or removed, so axis and lines need regeneration
    is_part_changed: Map<string, number>, //id name to old index in times/values, if -1, then it's new line and need line generation(data and graph)
    filter: number,
}

export interface time_obj{
    start: number,
    end: number,
    curr: number
}
type vectorKeys = 'magnitude' |'x' | 'y' | 'z';
type dataType = "position"|"velocity"|"acceleration"|"jerk"|"rotation";
export class DifferenceGraphPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;

    // times and values are states at first
    // but the setState function cannot update the state immediately
    protected times: number[][]; // times[i] is the array of times for line i
    protected values: (number|Quaternion)[][]; // values[i] is the array of values for line i
    protected line_ids_diff: string[] = []; //list of ids of lines graphed in diff graph
    protected currProperty: string; // a string containing the current property, i.e. &x&position

    constructor(props: graph_panel_props) {
        
        super(props);
        this.fillGraphData.bind(this);
        const rsmanager = this.props.robotSceneManager;
        this.state = {
            counter: 0,
            diff_times: [],
            diff_values: [],
            line_names_diff: [],
            line_ids: [], //list of names of lines graphed
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            use_timeWarp: false,
            color_map: new Map<string, string>(),
            currObjects: [],
            
            panelHeight: 200,
            panelWidth: 300,
            need_update: true,
            graph_update: false,
            is_part_changed: new Map<string, number>(),
            filter: this.props.graph.filter(),
        };
        this._graphDiv = createRef();
        this.times = [];
        this.values = [];
        this.currProperty= this.props.graph.currProperty();
    }

    /**
     * Helper function for handling All joints option in robot joint drop down
     * @param robot 
     * @param robotParts 
     * @param type 
     * @returns whether the robotParts Map has every joint in the robot and the given type are checked for all joints
     */
    // isAllJoints(robot:Robot, robotParts:Map<string, graph_part_obj>, type:string, dataType:dataType):boolean{
    //     // log("in isAllJoints")
    //     if(!(type === 'x' || type === 'y' || type === 'z' || type === 'angle')){
    //         log("invalid type in isAllJoints");
    //         return false;
    //     }
    //     for (const [jointName,] of robot.jointMap()) {
    //         if(!robotParts.has(jointName)){ //doesn't have all joints
    //             return false;
    //         }
    //         if(type === "angle" ){
    //             if(dataType === "position" && !robotParts.get(jointName)!.angle[0]){
    //                 return false;
    //             }else if(dataType === "velocity" && !robotParts.get(jointName)!.angle[1]){
    //                 return false;
    //             }else if(dataType === "acceleration" && !robotParts.get(jointName)!.angle[2]){
    //                 return false;
    //             }else if(dataType === "jerk" && !robotParts.get(jointName)!.angle[3]){
    //                 return false;
    //             }
    //         }else if((type === 'x' || type === 'y' || type === 'z') && !robotParts.get(jointName)!.position_type.includes(type) && dataType === "position"){
    //             return false;
    //         }else if((type === 'x' || type === 'y' || type === 'z') && !robotParts.get(jointName)!.velocity_type.includes(type) && dataType === "velocity"){
    //             return false;
    //         }else if((type === 'x' || type === 'y' || type === 'z') && !robotParts.get(jointName)!.acceleration_type.includes(type) && dataType === "acceleration"){
    //             return false;
    //         }else if((type === 'x' || type === 'y' || type === 'z') && !robotParts.get(jointName)!.jerk_type.includes(type) && dataType === "jerk"){
    //             return false;
    //         }
    //     }
    //     return true;
    // }

    /**
     * Call back function sent to LineGraph to let them know if graph update is needed, 
     * and they can respond after updating to avoid unnecessary updates
     * @param updated 
     * @returns current state of graph_update
     */
    onGraphUpdate(updated:boolean){
        const{graph_update} = this.state;
        if(!updated){
            return graph_update;
        }else{
            this.setState({
                graph_update: false
            });
        }
        
        return false;
    }

    
    /**
     * Helper function to compute number of true in a boolean array
     * @param arr 
     * @returns sum of arr
     */
    // booleanSum(arr:boolean[]):Number{
    //     let sum = 0;
    //     for(const a of arr){
    //         sum += Number(a);
    //     }
    //     return sum;
    // }

    /**
     * Return rotations for all the time
     * @param robot 
     * @param robotPart 
     * @param isWarped if true, then generate warped data, if null then raw data
     * @returns 
     */
    getRotations(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, isWarped?:boolean):[number[], Quaternion[]]{
        let rotations;
        
        const rsmanager = this.props.robotSceneManager;
        const robotScene = rsmanager.robotSceneById(robotSceneId)!;
        const startTime=rsmanager.startTime();
        const endTime=rsmanager.endTime();
        let timeRange:readonly number[];
        let timewarping = robotScene.timeWarping();
        if(isWarped && timewarping){
            // log(robotScene.timeWarping()?.timeWarp);
            // TODO the time range is incorrect, need to fix frameRange or find a different way to access the time range array after warping
            timeRange = timewarping.timeWarpMap()[1]//RobotScene.frameRange(startTime, endTime, 20, 2000, robotScene.timeWarping()?.timeWarp);
            // log(timeRange)
        }else{
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000);
        }
        if (robotPart === undefined) {
            // Need to add traces for the base of the robot;
            rotations = robotScene.frameDataFor(robot, timeRange, undefined);
            return [rotations.times, rotations.robotRotations];
        } else if (robotPart instanceof RobotLink) {
            // need to add trace for a robot link
            // console.log("robot link");
            rotations = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [rotations.times, rotations.linkRotations];
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a robot joint
            // console.log("robot joint");
            rotations = robotScene.frameDataFor(robot, timeRange, robotPart);
            // console.log("rotations");
            // console.log(rotations);
            return [rotations.times, rotations.jointRotations];
        } else {
            throw new Error("Unknown robot part type");
        }
    }

    /**
     * Return positions for all the time
     * @param robot 
     * @param robotPart 
     * @param angle 
     * @param key 
     * @param isWarped if true, then generate warped data, if null then raw data
     * @returns 
     */
    getPositions(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, angle: boolean, key:vectorKeys, isWarped?:boolean):[number[], number[]]{
        let positions;
        // const {robotScene/*, robot, robotPart, angle*/} = this.props;
        
        const rsmanager = this.props.robotSceneManager;
        const robotScene = rsmanager.robotSceneById(robotSceneId)!;
        const startTime=rsmanager.startTime();
        const endTime=rsmanager.endTime();
        let timeRange:readonly number[];
        let timewarping = robotScene.timeWarping();
        if(isWarped && timewarping){
            // log(robotScene.timeWarping()?.timeWarp);
            // TODO the time range is incorrect, need to fix frameRange or find a different way to access the time range array after warping
            timeRange = timewarping.timeWarpMap()[1]//RobotScene.frameRange(startTime, endTime, 20, 2000, robotScene.timeWarping()?.timeWarp);
            // log(timeRange)
        }else{
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000);
        }
        if (robotPart === undefined) {
            // Need to add traces for the base of the robot;
            positions = robotScene.frameDataFor(robot, timeRange, undefined);
            return [positions.times, this.getNumArr(positions.robotPositions, key)];
        } else if (robotPart instanceof RobotLink) {
            // need to add trace for a robot link
            // console.log("robot link");
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [positions.times, this.getNumArr(positions.linkPositions, key)];
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a robot joint
            // console.log("robot joint");
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            // console.log("positions");
            // console.log(positions);
            if (angle) {
                return [positions.times, positions.jointAngles];
            } else {
                return [positions.times, this.getNumArr(positions.jointPositions, key)];
            }
        } else {
            throw new Error("Unknown robot part type");
        }

        return [[0], [0]]
    }
    getVelocity(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, angle: boolean, key:vectorKeys, isWarped?:boolean):[number[], number[]]
    {
        if(key === "magnitude")
        {
            let velocities = this.getVelocityVector(robotSceneId, robot, robotPart, isWarped);
            return [velocities[0], this.calculateMagitude(velocities[1], velocities[2], velocities[3])];
        }
        else
        {
            const positions = this.getPositions(robotSceneId, robot, robotPart, angle, key, isWarped);
            //calculate velocity data
            let changeInData = this.genChangeData(positions[0], positions[1]);
            return changeInData;
        }
    }
    getAcceleration(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, angle: boolean, key:vectorKeys, isWarped?:boolean):[number[], number[]]
    {
        if(key === "magnitude")
        {
            let acc = this.getAccelerationVector(robotSceneId, robot, robotPart, isWarped);
            return [acc[0], this.calculateMagitude(acc[1], acc[2], acc[3])];
        }
        else
        {
            const velocities = this.getVelocity(robotSceneId, robot, robotPart, angle, key, isWarped);
            //calculate velocity data
            let changeInData = this.genChangeData(velocities[0], velocities[1]);
            return changeInData;
        }
    }
    getJerk(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, angle: boolean, key:vectorKeys, isWarped?:boolean):[number[], number[]]
    {
        if(key === "magnitude")
        {
            let jerk = this.getJerkVector(robotSceneId, robot, robotPart, isWarped);
            return [jerk[0], this.calculateMagitude(jerk[1], jerk[2], jerk[3])];
        }
        else
        {
            const acc = this.getAcceleration(robotSceneId, robot, robotPart, angle, key, isWarped);
            //calculate velocity data
            let changeInData = this.genChangeData(acc[0], acc[1]);
            return changeInData;
        }
    }

    getPositionVector(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, isWarped?:boolean):[number[], Vector3[]]
    {
        let positions;
        const rsmanager = this.props.robotSceneManager;
        const robotScene = rsmanager.robotSceneById(robotSceneId)!;
        const startTime=rsmanager.startTime();
        const endTime=rsmanager.endTime();
        let timeRange:readonly number[];
        let timewarping = robotScene.timeWarping();
        if(isWarped && timewarping){
            // log(robotScene.timeWarping()?.timeWarp);
            // TODO the time range is incorrect, need to fix frameRange or find a different way to access the time range array after warping
            timeRange = timewarping.timeWarpMap()[1]//RobotScene.frameRange(startTime, endTime, 20, 2000, robotScene.timeWarping()?.timeWarp);
            // log(timeRange)
        }else{
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000);
        }
        if (robotPart === undefined) {
            // Need to add traces for the base of the robot;
            positions = robotScene.frameDataFor(robot, timeRange, undefined);
            return [positions.times, positions.robotPositions];
        } else if (robotPart instanceof RobotLink) {
            // need to add trace for a robot link
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [positions.times, positions.linkPositions];
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a robot joint
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [positions.times, positions.jointPositions];
        } else {
            throw new Error("Unknown robot part type");
        }
    }

    getVectorArray(a: Vector3[]): number[][]
    {
        let result: number[][] = [[], [], []];
        for(let i = 0; i < a.length; i++){
            result[0].push(a[i].x);
            result[1].push(a[i].y);
            result[2].push(a[i].z);
        }
        return result;
    }
    getVelocityVector(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink,isWarped?:boolean, filter?: number):[number[], number[], number[], number[]]{
        let positions = this.getPositionVector(robotSceneId, robot, robotPart ,isWarped);
        let [px, py, pz] = this.getVectorArray(positions[1]);
        let vx = this.genChangeData(positions[0], px)[1];
        let vy = this.genChangeData(positions[0], py)[1];
        let vz = this.genChangeData(positions[0], pz)[1];
        return [positions[0], vx, vy, vz]
    }

    getAccelerationVector(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, isWarped?:boolean, filter?: number):[number[], number[], number[], number[]]{
        let [times, vx, vy, vz] = this.getVelocityVector(robotSceneId, robot, robotPart, isWarped, filter);
        let ax = this.genChangeData(times, vx)[1];
        let ay = this.genChangeData(times, vy)[1];
        let az = this.genChangeData(times, vz)[1];
        return [times, ax, ay, az]
    }

    getJerkVector(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, isWarped?:boolean, filter?: number):[number[], number[], number[], number[]]{
        let [times, ax, ay, az] = this.getAccelerationVector(robotSceneId, robot, robotPart, isWarped, filter);
        let jx = this.genChangeData(times, ax)[1];
        let jy = this.genChangeData(times, ay)[1];
        let jz = this.genChangeData(times, az)[1];
        return [times, jx, jy, jz]
    }

    calculateMagitude(x: number[], y: number[], z: number[]): number[]
    {
        let result = [];
        for(let i=0; i<x.length; i++)
            result.push(Math.sqrt(x[i]*x[i] + y[i]*y[i] + z[i]*z[i]));
        return result;
    }
    /**
     * Return positions for graphs bounded in curr start and end time - "zoomed-in graph"
     * @param robot 
     * @param robotPart 
     * @param angle 
     * @param key 
     * @returns 
     */
    getPositionsBounded(robotSceneId: string, robot: Robot, robotPart: undefined | RobotJoint | RobotLink, angle: boolean, key:vectorKeys, isWarped?:boolean):[number[], number[]]{
        let positions;
        // const {robotScene/*, robot, robotPart, angle*/} = this.props;
        const rsmanager = this.props.robotSceneManager;
        const robotScene = rsmanager.robotSceneById(robotSceneId)!;
        const startTime=rsmanager.currStartTime();
        const endTime=rsmanager.currEndTime()+0.1; //since position for is not inclusive of the endTime
        let timeRange:number[];
        if(isWarped){
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000, robotScene.timeWarping()?.timeWarp);
        }else{
            timeRange = RobotScene.frameRange(startTime, endTime, 20, 2000);
        }
        if (robotPart === undefined) {
            // Need to add traces for the base the robot;
            positions = robotScene.frameDataFor(robot, timeRange, undefined);
            return [positions.times, this.getNumArr(positions.robotPositions, key)];
        } else if (robotPart instanceof RobotLink) {
            // need to add trace for a robot link
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [positions.times, this.getNumArr(positions.linkPositions, key)];
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a  robot joint
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            if (angle) {
                return [positions.times, positions.jointAngles];
            } else {
                return [positions.times, this.getNumArr(positions.jointPositions, key)];
            }
        } else {
            throw new Error("Unknown robot part type");
        }

       
        return [[0],[0]];
    }
    /**
     * Helper function to process positions data
     * @param a vector3 array from robot/joint position
     * @param k x, y, or z component of the position
     * @returns list of position for one direction
     */
    getNumArr(a:Vector3[], k:vectorKeys):number[]{
        let result = [];
        if(k === 'magnitude')
        {
            for(let i = 0; i < a.length; i++){
                let x = a[i]['x'], y = a[i]['y'], z = a[i]['z'];
                result.push(Math.sqrt(x*x + y*y + z*z))
            }
        }
        else
        {
            for(let i = 0; i < a.length; i++){
                result.push(a[i][k])
            }
        }
        return result;
    }

     /**
     * 
     * @param time 
     * @param value data
     * @param filter indicate level of convolution filtering:
     *               0/None - no filtering
     *               1 - 1/4 1/2 1/4
     *               2 - 1/16 1/4 3/8 1/4 1/16
     *               ... and so on
     * @returns [0] new times, [1]list of differences between each data point (slope at each point)
     */
     genChangeData(time:number[], value:number[], filter?:number):[number[], number[]]{
        if(filter === undefined){
            filter = this.state.filter;
            // log("changed to state")
            //console.log("change to state " + filter);
        }
        //console.log("generate change data with filtering level " + filter);
        let result: [number[], number[]] = [[],[]];
        result[0] = [];
        result[1] = [];
        //smooth out data before taking change
        let newValue:number[] = [];
        while(filter && filter > 0 && value.length > 1){
            newValue[0] = value[0]/4 + value[0]/2 + value[1]/4;
            for(let i = 1; i < value.length-1; i ++){
                newValue[i] = value[i-1]/4 + value[i]/2 + value[i+1]/4;
            }
            newValue[value.length-1] = value[value.length-1]/4 + value[value.length-1]/2 + value[value.length-2]/4;
            value = _.cloneDeep(newValue);
            filter --;
            // log("in filtering data")
            // log(newValue); 
        }
        for(let i = 0; i < time.length-1; i++){
            result[0][i] = time[i];// (time[i+1] + time[i]) / 2; 
            result[1][i] = (value[i+1] - value[i]) / (time[i+1] - time[i]);
        }
        result[0][time.length-1] = time[time.length-1];
        result[1][time.length-1] = result[1][time.length-2];
        //console.log(result);
        return result;
    }

  /**
   * calculate the difference of two values
   * they can either both be numbers or both be Quaternion
   * @param x1 
   * @param x2 
   * @returns
   */
  calculateDifference(x1: Quaternion | number, x2: Quaternion | number) {
    if (typeof x1 === "number" && typeof x2 === "number") {
      return x2 - x1;
    }
    if (x1 instanceof Quaternion && x2 instanceof Quaternion) {
      x1 = x1.normalize();
      x2 = x2.normalize();
      const quaternionDiff = x2.clone().multiply(x1.clone().invert());
      let rotationAngle = 2 * Math.acos(quaternionDiff.w);
      if(rotationAngle > Math.PI) rotationAngle = 2 * Math.PI - rotationAngle;
      // const rotationAxis = new Vector3();
      // if (rotationAngle > 0.0001) {
      //   const s = Math.sqrt(1 - quaternionDiff.w * quaternionDiff.w);
      //   if (s >= 0.001) {
      //     rotationAxis.set(
      //       quaternionDiff.x / s,
      //       quaternionDiff.y / s,
      //       quaternionDiff.z / s
      //     );
      //   } else {
      //     rotationAxis.set(1, 0, 0);
      //   }
      // } else {
      //   rotationAxis.set(0, 0, 1);
      //   // rotationAngle = 0;
      // }
      return rotationAngle;
    }
    return 0;
  }
    /**
     * a helper function to fill the time and value data
     * @returns 
     */
    // fillTimeValData(id: string, diff_line_ids: string[], newDiffLineTimes: number[][], 
    //     newDiffLineVals: number[][], newTimes: number[][], newVals: number[][], index: number,
    //     newLineNames: string[], newLineIds: string[], name: string, 
    //     newDiffLineNames: string[], newDiffLineIds: string[])
    // {
    //   for (let i = 0; i < 2; i++) {
    //     if (id === diff_line_ids[i]) {
    //       // it is one of the two difference lines
    //       console.log(`the ${i}th line founded ` + id);
    //       newDiffLineTimes[i] = newTimes[index];
    //       newDiffLineVals[i] = newVals[index];
    //       newDiffLineNames.push(name);
    //       newDiffLineIds.push(id);
    //     }
    //   }

    //   newLineNames.push(name); //add to list
    //   newLineIds.push(id); //add to list
    // }
    // /**
    //  * a helper function to fill the time and value data
    //  * @returns 
    //  */
    // fillRotTimeValData(id: string, diff_line_ids: string[], newDiffLineTimes: number[][], 
    //     newDiffLineVals: Quaternion[][], newTimes: number[][], newVals: Quaternion[][], index: number,
    //     newLineNames: string[], newLineIds: string[], name: string, 
    //     newDiffLineNames: string[], newDiffLineIds: string[])
    // {
    //   for (let i = 0; i < 2; i++) {
    //     if (id === diff_line_ids[i]) {
    //       // it is one of the two difference lines
    //       console.log(`the ${i}th line founded ` + id);
    //       newDiffLineTimes[i] = newTimes[index];
    //       newDiffLineVals[i] = newVals[index];
    //       newDiffLineNames.push(name);
    //       newDiffLineIds.push(id);
    //     }
    //   }

    //   newLineNames.push(name); //add to list
    //   newLineIds.push(id); //add to list
    // }
    // /**
    //  * a helper function to check whether id exist in is_part_change
    //  * @param id 
    //  * @param is_part_changed 
    //  * @param use_timeWarp 
    //  * @returns false if not, true otherwise
    //  */
    // checkId(id:{value: string}, is_part_changed: Map<string, number>, use_timeWarp: {value: boolean})
    // {
    //     if(!is_part_changed.has(id.value)){
    //         if(!is_part_changed.has(id.value+ "&tw") ){
    //             console.log(`Error: ${id.value} does not exist in is_part_changed but in graph_list!`);
    //             return false;
    //         }
    //         use_timeWarp.value = true;
    //         id.value += "&tw";
    //     }
    //     return true;
    // }
    decomposePropertyName(propertyName: string)
    {
        const content = propertyName.split("&");
        const [,currSpeciProperty, currDataType] = content;
        return [currSpeciProperty, currDataType];
    }
     /**
     * fill times, values, zoomed_time, and other data structures to be 
     * passed to LineGraph component.
     * @param timeBoundChange if there is a time bound change
     * @param currTimeChange if there is a current time change
     * @param filterChange if the convolution filtering level has been changed
     * @returns 
     */
    fillGraphData(timeBoundChange?: boolean, currTimeChange?: boolean, filterChange?: boolean)
    {
      console.log("fill graph data is called");
      const currProperty = processProperties(this.currProperty);
      let { currObjects, is_part_changed, line_ids, use_timeWarp, color_map } = this.state;
      const rsmanager = this.props.robotSceneManager;
      const [currSpeciProperty_name, currDataType_name] = this.decomposePropertyName(currProperty);
      if (currSpeciProperty_name == undefined) return;
      console.log("current specific prop is " + currSpeciProperty_name);
      let angle = false;
      if (currSpeciProperty_name == "angle") angle = true;
      if(currDataType_name === undefined) return;
      const currDataType = this.convertStringToDataType(currDataType_name);
      if (currDataType == undefined) return;
      console.log("current data type is " + currDataType);

      let newTimes: number[][] = [];
      let newVals: (number|Quaternion)[][] = [];
      let times = this.times;
      let values = this.values;
      let index = 0;
      let newDVals: number[][] = []; //diff values
      let newDiffLineIds: string[] = [];
      let newDiffLineNames: string[] = [];
      let newColorMap = new Map<string, string>();
      
      newColorMap = _.cloneDeep(color_map);//deep copy of color_map
      
      for (const objectName of currObjects) {
        console.log("fillGraphData called in DifferenceGraphPanel");
        // console.log("event name is " + objectName);
        const contents = this.decomposeDragButtonId(objectName);
        const sceneId = contents[0];
        const currScene = rsmanager.robotSceneById(sceneId);
        if (currScene == undefined) return;
        console.log("scene id is " + sceneId);
        const robotName = contents[1];
        if (robotName == undefined) return;
        const robot = currScene.getRobotByName(robotName);
        if (robot === undefined) return;
        console.log("robot name is " + robotName);
        const partName = contents[2];
        if (partName == undefined) return;
        let robotPart: RobotJoint | RobotLink | undefined = robot.jointMap().get(partName);
        if (robotPart === undefined) {
          robotPart = robot.linkMap().get(partName);
          if (robotPart === undefined)
          {
            if(partName === robotName)
                robotPart = undefined;
            else
                return;
          }
        }
        console.log("part name is " + partName);

        const name = contents[0] + "#" + robotName;
        // let robotObj = graph_list.get(name);
        const id = objectName + currProperty; // name of the event i.e. sceneId#robotName&robotPart&dataType&property
        if (line_ids.includes(id)) {
          is_part_changed.set(id, line_ids.indexOf(id));
        } else {
          is_part_changed.set(id, -1);
        }
        let old_ind: number = is_part_changed.get(id)!; // get the old index
        if (old_ind === -1 || filterChange) { // new one
          const currSpeciProperty = angle ? 'x' : this.convertStringToVectorKey(currSpeciProperty_name);
          if (currDataType === "rotation") {
            const rotations = this.getRotations(sceneId, robot, robotPart, use_timeWarp);
            newTimes[index] = rotations[0];
            newVals[index] = rotations[1];
          }
          else if (currDataType === "position") {
            const positions = this.getPositions(sceneId, robot, robotPart, angle, currSpeciProperty, use_timeWarp);
            newTimes[index] = positions[0];
            newVals[index] = positions[1];
          }
          else if (currDataType === "velocity") {
            const velocities = this.getVelocity(sceneId, robot, robotPart, angle, currSpeciProperty, use_timeWarp);
            newTimes[index] = velocities[0];
            newVals[index] = velocities[1];
          }
          else if (currDataType === "acceleration") {
            const acc = this.getAcceleration(sceneId, robot, robotPart, angle, currSpeciProperty, use_timeWarp);
            newTimes[index] = acc[0];
            newVals[index] = acc[1];
          }
          else if (currDataType === "jerk") {
            const jerks = this.getJerk(sceneId, robot, robotPart, angle, currSpeciProperty, use_timeWarp);
            newTimes[index] = jerks[0];
            newVals[index] = jerks[1];
          }
          else {
            console.log("wrong data type");
          }
        } else { // old one
          newTimes[index] = times[old_ind];
          newVals[index] = values[old_ind];
        }
        const line_name = `${currScene.name()}_${robotName}_${partName}`;
        newDiffLineIds[index] = id;
        newDiffLineNames[index] = line_name;
        is_part_changed.set(id, index++);
      }
      // console.log(newVals);
      // console.log(newTimes);
      if (newVals.length === 2 && newTimes.length === 2 && newVals[0].length === newVals[1].length) {
        console.log("Can draw diff");
        newDVals[0] = [];
        newDVals[1] = [];
        for (let i = 0; i < newVals[0].length; i++) {
          newDVals[0][i] = 0;
          // newDVals[1][i] = newVals[1][i] - newVals[0][i];
          newDVals[1][i] = this.calculateDifference(newVals[0][i], newVals[1][i]);

          if (!newColorMap.has(newDiffLineIds[i])) { //add to colormap if not in there
            newColorMap.set(newDiffLineIds[i], this.props.graph.getColor());
          }
        }
        this.line_ids_diff = newDiffLineIds;
        this.setState({
          line_names_diff: newDiffLineNames,
        })
        this.props.graph.setLineNames(newDiffLineNames);
        this.props.graph.setLineIds(newDiffLineIds);
        let line_colors = [];
        for (const l of newDiffLineIds) {
            line_colors.push(newColorMap.get(l)!);
        }
        this.props.graph.setLineColors(line_colors);
      }

      times = newTimes;
      values = newVals;
      this.times = times;
      this.values = values;
      this.setState({
        diff_values: newDVals,
        diff_times: newTimes,
        prev_times: {
          start: rsmanager.currStartTime(),
          end: rsmanager.currEndTime(),
          curr: rsmanager.currTime()
        },
        color_map: newColorMap,
        is_part_changed: is_part_changed,
        need_update: false,
      });
    }

    componentWillUnmount() {
        if (this._panel_resize_observer) {
          this._panel_resize_observer.disconnect();
        }
    }
    componentDidMount(): void {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        this._panel_resize_observer = new ResizeObserver((entries)=>{
            // console.log(entries[0].contentRect);
            this.setState({
                panelWidth: (entries[0].contentRect.width),
                panelHeight: (entries[0].contentRect.height) * 0.85,
            });
        });
        if(this._graphDiv && this._graphDiv.current){
            this._panel_resize_observer.observe(this._graphDiv.current);
        }

        // draw lines based on the initial graph contents
        // this is mainly used to restore the graph contents
        const {graph} = this.props;
        this.currProperty = graph.currProperty();
        for(const line_id of graph.lineIds())
        {
            const [sceneId, robotName, partName, currSpeciProperty, currDataType] = this.decomposeEventName(line_id);
            let eventName = sceneId + "#" + robotName + "&" + partName;
            this.addNewLine(eventName, graph.currProperty());
        }
    }
    componentDidUpdate(prevProps:graph_panel_props) {
        const {prev_times, need_update} = this.state;
        const timeBoundChange = (prev_times.start !== this.props.robotSceneManager.currStartTime() || 
            prev_times.end !== this.props.robotSceneManager.currEndTime());
        // log("in component did update, currEndTime is " + this.props.robotSceneManager.currEndTime());
        const currTimeChange = prev_times.curr !== this.props.robotSceneManager.currTime();

        if(timeBoundChange)
        {
            this.setState({
                prev_times: {
                    start: this.props.robotSceneManager.currStartTime(),
                    end: this.props.robotSceneManager.currEndTime(),
                    curr: this.props.robotSceneManager.currTime()
                },
            })
        }
        if(currTimeChange ||
            // refresh ||
            // clear ||
            need_update
            ) {
            // log("Updating states in componentDidUpdate");
            this.fillGraphData(timeBoundChange, currTimeChange);
        }

        // Note: force_update updates all the graphs, not just selected one
        const{force_update} = this.props;
        const force_updateChnage = force_update !== prevProps.force_update;
        if (force_updateChnage)
            this.setState({
                need_update: true
            });
        if(this.props.robotSceneManager.getCurrGraph() !== this.props.graph) // if not the selected scene, do not update
            return;
        // react to the updates in GraphPropertyPanel
        const { eventName, add,} = this.props;
        const eventChnage = (eventName !== prevProps.eventName || add !== prevProps.add);
        if(eventChnage)
        {
          this.currProperty = eventName[0];
          this.props.graph.resetColor(); // reset all colors
          this.fillGraphData();
        }
        if(this.props.graph.filter() !== this.state.filter) {
            this.setState({
                filter: this.props.graph.filter(),
            });
            this.onChangeFilter(this.props.graph.filter());
        } 
    }

    onChangeFilter(e:number){
      console.log("on change filter");
      this.setState({
          filter: e,
          graph_update: true,
      });
      this.fillGraphData(false, false, true);
  }
  

    /**
     * decompose the eventName
     * to sceneId, robotName, partName, currSpeciProperty, currDataType
     * @param eventName
     * @returns 
     */
    decomposeEventName(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName, currSpeciProperty, currDataType] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName, currSpeciProperty, currDataType];
    }

    /**
     * convert a string to a dataType variable
     * @param data
     * @returns 
     */
    convertStringToDataType(data:string)
    {
        let currDataType: dataType;
        if (data === "position" || data === "velocity" || data === "acceleration" || data === "jerk" || data === "rotation") 
            currDataType = data;
        else
            throw Error(`${data} is not a property!!!!`);
        return currDataType;
    }

    /**
     * convert a string to a dataType variable
     * @param data
     * @returns 
     */
    convertStringToVectorKey(data:string)
    {
        let currSpeciProperty: vectorKeys;
        if (data === "x" || data === "y" || data === "z" || data === "magnitude") 
            currSpeciProperty = data;
        else
            throw Error(`${data} is not a property!!!!`);
        return currSpeciProperty;
    }


    onCheckUseTW(e:any){
        const {use_timeWarp} = this.state;
        this.setState({
            use_timeWarp: !use_timeWarp,
            graph_update: true,
            need_update: true
        });
        // this.fillGraphData(false, false, false);

    }
    
    /**
     * Handle dragging current time(red line on graph)
     * @param newValue 
     */
    onCurrTimeChange(newValue:number) {
        if(newValue <= this.props.robotSceneManager.currEndTime() && newValue >= this.props.robotSceneManager.currStartTime()){
            this.props.robotSceneManager.setCurrTime(newValue);
        }
    }

    /**
     * Handle dragging start time(left edge of yellow rectangle on graph)
     * @param newValue 
     */
    onStartTimeChange(newValue:number) {
        if(this.props.robotSceneManager.currTime()<newValue){
            this.props.robotSceneManager.setCurrTime(newValue);
        }
        if(this.props.robotSceneManager.currEndTime()>=newValue){
            this.props.robotSceneManager.setCurrStartTime(newValue);
        }
    }

    /**
     * Handle dragging end tiem(right edge of yellow rectangle on graph)
     * @param newValue 
     */
    onEndTimeChange(newValue:number) {
        // log("in onEndTimeChange");
        if(this.props.robotSceneManager.currTime()>newValue){
            this.props.robotSceneManager.setCurrTime(newValue);
        }
        if(this.props.robotSceneManager.currStartTime()<=newValue){
            this.props.robotSceneManager.setCurrEndTime(newValue);
        }
    }


    /**
     * Handle deleting a line
     * @param line in a format of "sceneId#robotName&partName&currSpeciProperty&currDataType"
     */
    onDeleteChange(line: string) {
        //console.log("delete " + line);
        //this.OnChangeGraph(line, false);
    }


    /**
     * enable the button to be dragged over the panel
     * @param event 
     */
    dragOverHandler(event: any) {
        event.preventDefault();
    }
    
    /**
     * handle the drop of a button
     * store the information of the button in currObjects
     * the info has a format like scene_id#robot_name&robotpart_name
     * @param event 
     * @returns 
     */
    
    dropHandler(event: any) {
        event.preventDefault();
        const windowElement = event.target;
        let eventName = event.dataTransfer.getData("text/plain");
        let properties = processProperties(this.currProperty);
        this.addNewLine(eventName, properties);
    }

    addNewLine(eventName: string, currProperty: string)
    {
        const[sceneId, robotName, partName] = this.decomposeId(eventName);
        const {robotSceneManager} = this.props;
        let scene = robotSceneManager.robotSceneById(sceneId);
        if(scene !== undefined) 
        {
            if(!robotSceneManager.isActiveRobotScene(scene))
                robotSceneManager.activateRobotScene(scene);
            let robotPart: RobotJoint | RobotLink | undefined = scene.getJointByName(robotName, partName);
            if (robotPart === undefined)
                robotPart = scene.getLinkByName(robotName, partName);
            if(robotPart !== undefined)
                robotPart.addToGraph();
            else
            {
                let robot = scene.getRobotByName(robotName);
                if(robot !== undefined) robot.addToGraph();
            }
        }
        const {currObjects} = this.state;
        if(currObjects.length > 2) return; // already has two lines to compare
        currObjects.push(eventName);
        this.line_ids_diff.push(eventName + currProperty);
        if(this.line_ids_diff.length === 2)
          this.fillGraphData();
            // this.OnChangeGraph(this.line_ids_diff, true);
        this.setState({
            currObjects: this.state.currObjects
        });
    }

    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeId(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName];
    }
    /**
     * handle the click of the Difference Graph Panel
     * update the id of currently selected panel
     */
    clickHandler = () => {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        
        this.props.setGraphOptionPanelActive();
        this.props.graph.setCurrProperty(this.currProperty);
        this.props.robotSceneManager.setCurrGraph(this.props.graph.id());
    };
    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeDragButtonId(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName];
    }

    /**
     * decompose the id of a line
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeLineId(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName, currSpeciProperty, currProperty] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName, currSpeciProperty, currProperty];
    }

    showDiffLineNames()
    {
        const {currObjects} = this.state;
        let line_names_diff = [];
        for(let i=0; i<2; i++)
        {
            if(currObjects[i] !== undefined)
            {
                const [sceneId, robotName, partName] = this.decomposeDragButtonId(currObjects[i]);
                const sceneName = this.props.robotSceneManager.robotSceneById(sceneId)?.name();
                line_names_diff[i] = sceneName + "_" + robotName + "_" + partName;
            }
        }
        return (
            <div>
                 {line_names_diff[0] !== undefined && <p>the first (reference) line is {line_names_diff[0]}</p>}
                 {line_names_diff[1] !== undefined && <p>the second line is {line_names_diff[1]}</p>}
            </div>
        );
    }
    // check if time has changed in render manually
    render() {
        const {
            diff_values, diff_times, /*show_diff,*/ use_timeWarp,
            /*line_names, line_ids,*/ color_map, 
            prev_times,
            panelHeight, panelWidth,
            line_names_diff} = this.state;
        const currProperty = this.currProperty;
        // console.log(diff_values);
        // console.log(diff_times);
        const {is_part_changed} = this.props;
        const rsmanager = this.props.robotSceneManager;
        let line_ids_diff = this.line_ids_diff;
        // console.log("state legend is " + legend);
        // console.log("props legend is " + this.props.legend_prop);
        let line_colors:string[] = [];
        for(const l of line_ids_diff){
            line_colors.push(color_map.get(l)!);
            //translate line_names to readable names
        }
        // console.log("line colors: ");
        // console.log(line_colors);
        const [,detail, property] = currProperty.split("&");
        let title = property + " in " + detail;
        if(property === "rotation")
          title = "Rotational";
        if(property.startsWith("joint"))
          title = property;
        let selected:boolean = (this.props.robotSceneManager.getCurrGraph() === this.props.graph);
        return (
          <div className={"GraphPanel"} ref={this._graphDiv} 
          onDrop={this.dropHandler.bind(this)}
          onDragOver={this.dragOverHandler.bind(this)}
          onClick={this.clickHandler.bind(this)}
          style={{backgroundColor: this.props.graph.backgroundColor()}}>
                <div className="LegendMessage">
                    <DragButton
                        buttonValue={"Legend"}
                        className={"Legend"}
                        title={"Click and drag to open the legend"}
                        getParentDockLayout={this.props.getParentDockLayout}
                        onDragStart={() => {

                            return [
                                // Tab ID
                                `LineGraphLegend&${newID(4)}&${this.props.graph.id()}`,

                                // onDrop Callback
                                (e) => {
                                },
                            ];
                        }}
                    />
                    <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.DifferenceGraphPanel)}>
                        <FontAwesomeIcon className="Icon" icon={faQuestion} />
                    </button>
                    
                </div>
                {this.showDiffLineNames()}
            {
              <LineGraph
                times={diff_times}
                vals={diff_values}
                startTime={rsmanager.currStartTime()}
                endTime={rsmanager.currEndTime()}
                currTime={rsmanager.currTime()}
                isZoom={false}
                isDiff={true}
                isTimeWarp={false}
                line_names={line_names_diff}
                line_colors={line_colors}
                title={title}
                width={panelWidth}
                height={panelHeight}
                line_ids={line_ids_diff}
                prev_map={is_part_changed}
                selected={selected}
                lineWidth={this.props.graph.lineWidth()}
                axisColor={this.props.graph.axisColor()}
                onGraphUpdate={this.onGraphUpdate.bind(this)}
                onCurrChange={this.onCurrTimeChange.bind(this)}
                onStartChange={this.onStartTimeChange.bind(this)}
                onEndChange={this.onEndTimeChange.bind(this)}
                onDeleteChange={this.onDeleteChange.bind(this)}
              />
            }
          </div>
        );
    }
}