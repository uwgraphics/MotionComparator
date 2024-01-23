import React, { Component, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotJoint } from "../../objects3D/RobotJoint";
import { RobotLink } from "../../objects3D/RobotLink";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { genSafeLogger, newID, processProperties } from "../../helpers";
import { LineGraph } from "../LineGraph";
import { Vector3 } from "three";
// import { color } from "d3";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { Graph } from "../../objects3D/Graph";
import { DragButton } from "../DragButton";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
// import { time } from "console";
//TODO timewarped positions graph
export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    robotScene?: RobotScene,
    getParentDockLayout: () => DockLayout | undefined,
    eventName:string[],
    add:boolean,
    filter_prop: number,
    is_part_changed: Map<string, number>, //id name to old index in times/values, if -1, then it's new line and need line generation(data and graph)
    force_update: boolean,
    graph: Graph,
    graph_update: boolean, // whether to update the graph or not (This variable is created to make sure the graph panel react to the deletion in legend panel. Without it, the graph panel will wait a few seconds before it updates)
    setGraphOptionPanelActive: () => void,
}

interface graph_panel_state {
    counter:number,
    //times: number[][], // times[i] is the array of times for line i
    //values: number[][], // values[i] is the array of values for line i
    prev_times: time_obj, //previous "current times" used for componentDidUpdate
    use_timeWarp: boolean, // whether to use timewarped data instead of raw data
    refresh: boolean, // whether to refresh the data or not
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of names of lines graphed
    color_map: Map<string, string>, //map line name to color
    currObjects: Set<string>, // a set of current objects, i.e. Scene4.id#sawyer&right_j0 
    currProperty: string, // a string containing the current property, i.e. &x&position
    currScene: RobotScene | undefined,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    is_part_changed: Map<string, number>, //id name to old index in times/values, if -1, then it's new line and need line generation(data and graph)
    graph_list: Map<string, graph_obj>,//the list of the lines needed to be graphed; graph_obj[] //key = scene id # robot id?
    need_update: boolean // need to update graph data to trigger fillGraphData
    graph_update: boolean // need to update graph->sent to LineGraph components when lines are added or removed, so axis and lines need regeneration
    filter: number, // level of convolution filtering for velocity, acceleration, and jerk
    velocity_map: Map<string, number[][]>, //cache velocity
    acceleration_map:  Map<string, number[][]>, //cache acc
}
interface graph_obj {
    robotScene: string, //scene id
    robot: Robot,
    position_type: vectorKeys[], //for relative position of whole robot
    position_type_tw?: vectorKeys[], //for relative position of whole robot
    velocity_type: vectorKeys[], //for velocity generated from position of whole robot
    acceleration_type: vectorKeys[],
    jerk_type: vectorKeys[],
    robotParts: Map<string, graph_part_obj>,//key = robot part id
}
interface graph_part_obj {
    robotPart: RobotJoint | RobotLink | undefined,
    position_type: vectorKeys[],
    position_type_tw?: vectorKeys[], //for relative position of whole robot

    velocity_type: vectorKeys[],
    acceleration_type: vectorKeys[],
    jerk_type: vectorKeys[],
    angle: boolean[],
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
type vectorKeys = 'magnitude' | 'x' | 'y' | 'z';
type dataType = "position"|"velocity"|"acceleration"|"jerk";
type robotPartType = RobotJoint | RobotLink | undefined;
const log = genSafeLogger(5000);
export class GraphPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;

    // times and values are states at first
    // but the setState function cannot update the state immediately
    protected times: number[][]; // times[i] is the array of times for line i
    protected values: number[][]; // values[i] is the array of values for line i

    constructor(props: graph_panel_props) {
        
        super(props);
        this.getPositions.bind(this);
        this.fillGraphData.bind(this);
        const rsmanager = this.props.robotSceneManager;
        this.state = {
            counter: 0,
            //times: [],
            //values: [],
            graph_list: new Map<string, graph_obj>(),
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            use_timeWarp: false,
            line_names: [],
            line_ids: [],
            color_map: new Map<string, string>(),
            refresh: false,
            currObjects: new Set<string> (),
            currProperty: this.props.graph.currProperty(),
            currScene: undefined/*this.props.robotScene*/,
            panelHeight: 200,
            panelWidth: 300,
            is_part_changed: new Map<string, number>(),
            need_update: true,
            graph_update: false,
            filter: this.props.graph.filter(),
            velocity_map: new Map<string, number[][]>(),
            acceleration_map: new Map<string, number[][]>(),
        };
        this.times = [];
        this.values = [];
        this._graphDiv = createRef();
        //activate current robot scene if not already( and if curr robot scene prop isn't empty)
        // if(this.props.robotScene && !rsmanager.activeRobotScenes().includes(this.props.robotScene)){
        //     rsmanager.activateRobotScene(this.props.robotScene);
        // }
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
            console.log("robot link");
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            return [positions.times, this.getNumArr(positions.linkPositions, key)];
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a robot joint
            console.log("robot joint");
            positions = robotScene.frameDataFor(robot, timeRange, robotPart);
            console.log("positions");
            console.log(positions);
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
     * Helper function for handling All joints option in robot joint drop down
     * @param robot 
     * @param robotParts 
     * @param type 
     * @returns whether the robotParts Map has every joint in the robot and the given type are checked for all joints
     */
    isAllJoints(robot:Robot, robotParts:Map<string, graph_part_obj>, type:string, dataType:dataType):boolean{
        // log("in isAllJoints")
        if(!(type === 'x' || type === 'y' || type === 'z' || type === 'angle' || type === 'magnitude')){
            log("invalid type in isAllJoints");
            return false;
        }
        for (const [jointName,] of robot.jointMap()) {
            if(!robotParts.has(jointName)){ //doesn't have all joints
                return false;
            }
            if(type === "angle" ){
                if(dataType === "position" && !robotParts.get(jointName)!.angle[0]){
                    return false;
                }else if(dataType === "velocity" && !robotParts.get(jointName)!.angle[1]){
                    return false;
                }else if(dataType === "acceleration" && !robotParts.get(jointName)!.angle[2]){
                    return false;
                }else if(dataType === "jerk" && !robotParts.get(jointName)!.angle[3]){
                    return false;
                }
            }else if((type === 'x' || type === 'y' || type === 'z' || type === 'magnitude') && !robotParts.get(jointName)!.position_type.includes(type) && dataType === "position"){
                return false;
            }else if((type === 'x' || type === 'y' || type === 'z' || type === 'magnitude') && !robotParts.get(jointName)!.velocity_type.includes(type) && dataType === "velocity"){
                return false;
            }else if((type === 'x' || type === 'y' || type === 'z' || type === 'magnitude') && !robotParts.get(jointName)!.acceleration_type.includes(type) && dataType === "acceleration"){
                return false;
            }else if((type === 'x' || type === 'y' || type === 'z' || type === 'magnitude') && !robotParts.get(jointName)!.jerk_type.includes(type) && dataType === "jerk"){
                return false;
            }
        }
        return true;
    }

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
    booleanSum(arr:boolean[]):Number{
        let sum = 0;
        for(const a of arr){
            sum += Number(a);
        }
        return sum;
    }

    /**
     * Given a RobotScene and a robot name, return the robot object
     * @param robotScene 
     * @param name 
     * @returns 
     */
    static getRobotByName(robotScene: RobotScene, name:String):Robot|undefined{
        const robots = robotScene.robots();
        for(let i = 0; i < robots.length; i++){
            if(robots[i].name() === name){
                return robots[i];
            }
        }
        return;
    }

    
    /**
     * check if anything is new(-1) 
     * @returns boolean
     */
    isPartChanged():boolean {
        const {is_part_changed} = this.state;
        for (const [, ind] of is_part_changed) {
            if(ind === -1){
                return true;
            }
        }
        return false;
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
    genChangeData(time:number[], value:number[], filter?:number):number[][]{
        if(filter === undefined){
            filter = this.state.filter;
            // log("changed to state")
            //console.log("change to state " + filter);
        }
        //console.log("generate change data with filtering level " + filter);
        let result: number[][] = [];
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
     * a helper function to fill the time and value data
     * @returns 
     */
    fillTimeValData(id: string, newLineNames: string[], newLineIds: string[], name: string)
    {
      newLineNames.push(name); //add to list
      newLineIds.push(id); //add to list
    }

    /**
     * a helper function to check whether id exist in is_part_change
     * @param id 
     * @param is_part_changed 
     * @param use_timeWarp 
     * @returns false if not, true otherwise
     */
    checkId(id:{value: string}, is_part_changed: Map<string, number>, use_timeWarp: {value: boolean})
    {
        if(!is_part_changed.has(id.value)){
            if(!is_part_changed.has(id.value+ "&tw") ){
                console.log(`Error: ${id} does not exist in is_part_changed but in graph_list!`);
                return false;
            }
            use_timeWarp.value = true;
            id.value += "&tw";
        }
        return true;
    }
    /**
     * fill times, values, zoomed_time, and other data structures to be 
     * passed to LineGraph component.
     * @param timeBoundChange if there is a time bound change
     * @param currTimeChange if there is a current time change
     * @param filterChange if the convolution filtering level has been changed
     * @returns 
     */
    fillGraphData(timeBoundChange?: boolean, currTimeChange?: boolean, filterChange?: boolean){
        //  console.log("fill graph data is called");
        const {graph_list, is_part_changed, color_map, currScene, refresh,
            velocity_map, acceleration_map,} = this.state;
        const rsmanager = this.props.robotSceneManager;
        const graph = this.props.graph;
        let times = this.times;
        let values = this.values;
        // console.log(graph_list);
        // console.log(is_part_changed);
    
        let index = 0;
        //new lists to be filled and stored in states
        let newTimes:number[][] = [];
        let newVals:number[][] = [];
        let newLineNames: string[] = [];
        let newLineIds: string[] = [];
        let newColorMap = new Map<string, string>();

        // log("in fillGraphData: use timewarp is " + use_timeWarp);

        
        let name = "";
        let id = "";
        let use_timeWarp = this.state.use_timeWarp;
        let positionMap = new Map<vectorKeys, number>();
        // let velocityMap = new Map<vectorKeys, number[][]>();
        // let accelerationMap = new Map<vectorKeys, number[][]>();
        if (!refresh){
            newColorMap = _.cloneDeep(color_map);//deep copy of color_map
        }
        for (const [obj_name, obj] of graph_list) {
            const [sceneId, robotName] = obj_name.split("#");
            //fill in obj's relative position data
            const objPos = obj.position_type;
            // const objPosTw = obj.position_type_tw??[];
            const objVel = obj.velocity_type;
            const objAcc = obj.acceleration_type;
            const objJerk = obj.jerk_type;
            // console.log("object positions " + objPos);
            // console.log("object velocity " + objVel);
            // console.log("object acceleration " + objAcc);
            // console.log("object jerk " + objJerk);
            //iterate through everything that needs to be graphed
            for(let i = 0; i < objPos.length; i++){ //iterate through position vector
                console.log("object position" + obj_name);
                id = `${obj_name}&${objPos[i]}&position`;
                if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                    continue;
                let old_ind:number = is_part_changed.get(id)!; // get the old index of the position vector
                if(old_ind === -1 || filterChange){ // new one
                    const positions = this.getPositions(sceneId, obj.robot, undefined, false, objPos[i], use_timeWarp);
                    newTimes[index] = positions[0];
                    newVals[index] = positions[1];
                }else{ // old one
                    newTimes[index] = times[old_ind];
                    newVals[index] = values[old_ind];
                }

                positionMap.set(objPos[i], index);//so that velocity graph do not need to regenerate data
                
                is_part_changed.set(id, index);
                
                name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${objPos[i]}_Cartesian position${use_timeWarp?"_tw":""}`;
                this.fillTimeValData(id, newLineNames, newLineIds, name);

                if(!newColorMap.has(id)){ //add to colormap if not in there
                    newColorMap.set(id, graph.getColor()); 
                }
                index ++;
            }

            for(let i = 0; i < objVel.length; i++){ //iterate through velocity vector
                use_timeWarp = false;
                console.log("object velocity" + obj_name);
                id = `${obj_name}&${objVel[i]}&velocity`;
                if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                    continue;
                let old_ind:number = is_part_changed.get(id)!; 
                if(old_ind === -1 || filterChange){
                    if(objVel[i] === 'magnitude')
                    {
                        let velocities = this.getVelocityVector(sceneId, obj.robot, undefined, use_timeWarp);
                        newTimes[index] = velocities[0];
                        newVals[index] = this.calculateMagitude(velocities[1], velocities[2], velocities[3]);
                    }
                    else {
                        let positions;
                        //fetch position data
                        let map_ind = positionMap.get(objVel[i]);
                        if (!map_ind) {
                            positions = this.getPositions(sceneId, obj.robot, undefined, false, objVel[i], use_timeWarp);
                        } else {
                            positions = [newTimes[map_ind], newVals[map_ind]]
                        }
                        //calculate velocity data
                        let changeInData = this.genChangeData(positions[0], positions[1]);
                        velocity_map.set(obj_name + "&" + objVel[i], this.genChangeData(positions[0], positions[1], 0));//so that acc graph do not need to regenerate data
                        newTimes[index] = changeInData[0];
                        newVals[index] = changeInData[1];
                    }
                }else{
                    newTimes[index] = times[old_ind];
                    newVals[index] = values[old_ind];
                }
                
                
                
                is_part_changed.set(id, index);
                name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${objVel[i]}_Cartesian velocity${use_timeWarp?"_tw":""}`;
                this.fillTimeValData(id, newLineNames, newLineIds, name);

                if(!newColorMap.has(id)){ //add to colormap if not in there
                    newColorMap.set(id, graph.getColor()); 
                }
                index ++;
            }
            for(let i = 0; i < objAcc.length; i++){ //iterate through acc vector
                use_timeWarp = false;
                console.log("object acceleration" + obj_name);
                id = `${obj_name}&${objAcc[i]}&acceleration`;
                if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                    continue;
                let old_ind:number = is_part_changed.get(id)!; 
                if(old_ind === -1 || filterChange){
                    if(objAcc[i] === "magnitude")
                    {
                        let acc = this.getAccelerationVector(sceneId, obj.robot, undefined, use_timeWarp);
                        newTimes[index] = acc[0];
                        newVals[index] = this.calculateMagitude(acc[1], acc[2], acc[3]);
                    }
                    else {

                        let velocities;
                        let vel = velocity_map.get(id);
                        if (!vel) {
                            log("no index for velocity")
                            let positions;
                            //fetch position data
                            let map_ind = positionMap.get(objAcc[i]);
                            if (!map_ind) {
                                log("no index for position")
                                positions = this.getPositions(sceneId, obj.robot, undefined, false, objAcc[i], use_timeWarp);
                            } else {
                                log("has position")
                                positions = [newTimes[map_ind], newVals[map_ind]]
                            }
                            log("computed velocity")
                            let changeInData = this.genChangeData(positions[0], positions[1], 0);
                            velocity_map.set(obj_name + "&" + objAcc[i], changeInData);
                            velocities = [changeInData[0], changeInData[1]];
                        } else {
                            velocities = [vel[0], vel[1]];
                        }

                        //calculate acceleration data
                        let changeInData = this.genChangeData(velocities[0], velocities[1]);
                        acceleration_map.set(obj_name + "&" + objAcc[i], this.genChangeData(velocities[0], velocities[1], 0));//so that jerk graph do not need to regenerate data
                        newTimes[index] = changeInData[0];
                        newVals[index] = changeInData[1];
                    }
                }else{
                    newTimes[index] = times[old_ind];
                    newVals[index] = values[old_ind];
                }
                //acceleration_map.set(objAcc[i], index);//so that jerk graph do not need to regenerate data

                is_part_changed.set(id, index);
                
                name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${objAcc[i]}_Cartesian acceleration${use_timeWarp?"_tw":""}`;
                this.fillTimeValData(id, newLineNames, newLineIds, name);

                if(!newColorMap.has(id)){ //add to colormap if not in there
                    newColorMap.set(id, graph.getColor()); 
                }
                index ++;
            }
            for(let i = 0; i < objJerk.length; i++){ //iterate through jerk vector
                console.log("object jerk" + obj_name);
                use_timeWarp = false;
                id = `${obj_name}&${objJerk[i]}&jerk`;
                if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                    continue;
                let old_ind:number = is_part_changed.get(id)!; 
                if(old_ind === -1 || filterChange){
                    if (objJerk[i] === 'magnitude') 
                    {
                        let jerk = this.getJerkVector(sceneId, obj.robot, undefined, use_timeWarp);
                        newTimes[index] = jerk[0];
                        newVals[index] = this.calculateMagitude(jerk[1], jerk[2], jerk[3]);
                    }
                    else {
                        let accelerations;
                        let acc = acceleration_map.get(obj_name + "&" + objJerk[i]);
                        if (!acc) {
                            let velocities;
                            let vel = velocity_map.get(obj_name + "&" + objJerk[i]);
                            if (!vel) {
                                let positions;
                                //fetch position data
                                let map_ind = positionMap.get(objJerk[i]);
                                if (!map_ind) {
                                    positions = this.getPositions(sceneId, obj.robot, undefined, false, objJerk[i], use_timeWarp);
                                } else {
                                    positions = [newTimes[map_ind], newVals[map_ind]]
                                }
                                let changeInData = this.genChangeData(positions[0], positions[1], 0);
                                velocity_map.set(obj_name + "&" + objJerk[i], changeInData);
                                velocities = [changeInData[0], changeInData[1]];
                            } else {
                                velocities = [vel[0], vel[1]];
                            }
                            let changeInData = this.genChangeData(velocities[0], velocities[1], 0);
                            acceleration_map.set(obj_name + "&" + objJerk[i], changeInData);
                            accelerations = [changeInData[0], changeInData[1]];
                        } else {
                            accelerations = [acc[0], acc[1]];
                        }

                        //calculate acceleration data
                        let changeInData = this.genChangeData(accelerations[0], accelerations[1]);
                        newTimes[index] = changeInData[0];
                        newVals[index] = changeInData[1];
                    }
                }else{
                    newTimes[index] = times[old_ind];
                    newVals[index] = values[old_ind];
                }

                is_part_changed.set(id, index);
                name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${objJerk[i]}_Cartesian jerk${use_timeWarp?"_tw":""}`;
                this.fillTimeValData(id, newLineNames, newLineIds, name);

                if(!newColorMap.has(id)){ //add to colormap if not in there
                    newColorMap.set(id, graph.getColor()); 
                }
                index ++;
            }
            //////////////////TODO////////////////////////////////////////////////////////////////////
            //fill in obj's parts' data (angle and position)
            
            for(const [part_obj_name, part_obj] of obj.robotParts) {
                use_timeWarp = false;
                //iterate through part angle related things that are selected to be graphed
                if(part_obj.angle[0]){ // position angle
                    id = obj_name+"&"+part_obj_name+"&angle&position";
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!;
                    if(old_ind === -1 || filterChange){
                        console.log("filter changes");
                        const positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, true, 'x', use_timeWarp); //x here has no use, just to keep typescript from complaining
                        newTimes[index] = positions[0];
                        newVals[index] = positions[1];
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }

                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_\n${part_obj_name}_joint_position${use_timeWarp?"_tw":""}`; //_position
                    this.fillTimeValData(id, newLineNames, newLineIds, name);
                    
                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }

                    index ++;
                }
                if(part_obj.angle[1]){ // velocity angle
                    id = obj_name+"&"+part_obj_name+"&angle&velocity";
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!;
                    if(old_ind === -1 || filterChange){
                        let positions;
                        if(!part_obj.angle[0]){
                            positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, true, 'x', use_timeWarp); //x here has no use, just to keep typescript from complaining
                        }else{
                            positions = [newTimes[index-1], newVals[index-1]]; //if angle is plotted then it must be right before angular velocity
                        }
                        let changeInData = this.genChangeData(positions[0], positions[1]);
                        newTimes[index] = changeInData[0];
                        newVals[index] = changeInData[1];
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }

                    is_part_changed.set(id, index);
                    
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_\n${part_obj_name}_joint_velocity${use_timeWarp?"_tw":""}`; 
                    this.fillTimeValData(id, newLineNames, newLineIds, name);

                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }

                    index ++;
                }
                if(part_obj.angle[2]){ // acceleration angle
                    let partName = obj_name+"&"+part_obj_name+"&angle";
                    id = partName+"&acceleration";
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!; 
                    if(old_ind === -1 || filterChange){
                        let velocities;
                        let vel = velocity_map.get(partName);
                        if(!vel){
                            console.log("no cache for velocity "+partName);
                            let positions;
                            //TODO check cache position data is correct
                            let map_ind = is_part_changed.get(partName+"&position");
                            if(!map_ind){
                            //     log("no index for position")
                                positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, true, 'x', use_timeWarp);//x is just to stop ts from complaining
                            }else{
                                console.log("has position")
                                positions = [newTimes[map_ind], newVals[map_ind]]
                            }
                            console.log(newTimes);
                            let changeInData = this.genChangeData(positions[0], positions[1], 0);
                            velocity_map.set(partName, changeInData);
                            velocities = [changeInData[0], changeInData[1]];
                        }else{
                            velocities = [vel[0], vel[1]];//[newTimes[map_ind], newVals[map_ind]]; //TODO
                        }
                        
                        //calculate acceleration data
                        let changeInData = this.genChangeData(velocities[0], velocities[1]);
                        acceleration_map.set(partName, this.genChangeData(velocities[0], velocities[1], 0));
                        newTimes[index] = changeInData[0];
                        newVals[index] = changeInData[1];
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }
                    // jointAccMap.set(partObjAcc[i], index);//so that jerk graph do not need to regenerate data
    
                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_\n${part_obj_name}_joint_acceleration${use_timeWarp?"_tw":""}`; 
                    this.fillTimeValData(id, newLineNames, newLineIds, name);
    
                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }
                    index ++;
                }
                if (part_obj.angle[3]) { //TODO angular jerk
                  let partName = obj_name + "&" + part_obj_name + "&angle";
                  id = partName + "&jerk";
                  if (!this.checkId({ value: id }, is_part_changed, {value: use_timeWarp,}))
                    continue;
                  let old_ind: number = is_part_changed.get(id)!;
                  if (old_ind === -1 || filterChange) {
                    let accelerations;
                    let acc = acceleration_map.get(partName);
                    if (!acc) {
                      let velocities;
                      let vel = velocity_map.get(partName);
                      if (!vel) {
                        log("no cache for velocity " + partName);
                        let positions;
                        //TODO check cache position data is correct
                        let map_ind = is_part_changed.get(
                          partName + "&position"
                        );
                        if (!map_ind) {
                          //     log("no index for position")
                          positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, true, 'x', use_timeWarp);//x is just to stop ts from complaining
                        } else {
                          log("has position");
                          positions = [newTimes[map_ind], newVals[map_ind]];
                        }
                        log("computed velocity");
                        let changeInData = this.genChangeData(positions[0], positions[1], 0);
                        velocity_map.set(partName, changeInData);
                        velocities = [changeInData[0], changeInData[1]];
                      } else {
                        velocities = [vel[0], vel[1]]; //[newTimes[map_ind], newVals[map_ind]]; //TODO
                      }

                      //calculate acceleration data
                      let changeInData = this.genChangeData(velocities[0],velocities[1]);
                      acceleration_map.set(partName,this.genChangeData(velocities[0], velocities[1], 0));
                      accelerations = [changeInData[0], changeInData[1]];
                    } else {
                      accelerations = [acc[0], acc[1]]; //[newTimes[map_ind], newVals[map_ind]];//TODO
                    }

                    //calculate jerk data
                    let changeInData = this.genChangeData(accelerations[0], accelerations[1]);
                    acceleration_map.set(partName, this.genChangeData(accelerations[0], accelerations[1], 0));
                    newTimes[index] = changeInData[0];
                    newVals[index] = changeInData[1];
                  } else {
                    newTimes[index] = times[old_ind];
                    newVals[index] = values[old_ind];
                  }

                  is_part_changed.set(id, index);
                  name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_\n${part_obj_name}_joint_jerk${use_timeWarp?"_tw":""}`; 
                  this.fillTimeValData(id, newLineNames, newLineIds, name);
                  if(!newColorMap.has(id)){ //add to colormap if not in there
                    newColorMap.set(id, graph.getColor()); 
                    } 
                  index ++;
                }



                //////////////////////////////////////////////////////////////////////////////////////
                //fill in obj's parts' data (other than angles)       
                
                const partObjPos = part_obj.position_type;
                const partObjVel = part_obj.velocity_type;
                const partObjAcc = part_obj.acceleration_type;
                const partObjJerk = part_obj.jerk_type;
                // console.log("object part positions " + partObjPos);
                // console.log("object part velocity " + partObjVel);
                // console.log("object part acceleration " + partObjAcc);
                // console.log("object part jerk " + partObjJerk);
                let jointPosMap = new Map<vectorKeys, number>();
                //iterate through part things other than angles that needed be graphed
                for(let i = 0; i < partObjPos.length; i++){ //iterate through pos vector
                    use_timeWarp = false;
                    id = obj_name+"&"+part_obj_name+"&"+partObjPos[i]+"&position";

                    console.log("id is " + id);
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!;
                    console.log("generate positions");
                    if(old_ind === -1 || filterChange){
                        console.log("new one");
                        const positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, false, partObjPos[i], use_timeWarp);
                        console.log("positions")
                        console.log(positions);
                        newTimes[index] = positions[0];
                        newVals[index] = positions[1];
                    }else{
                        console.log("old one");
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }
                    jointPosMap.set(partObjPos[i], index);

                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${part_obj_name}_${partObjPos[i]}_Cartesian position${use_timeWarp?"_tw":""}`; 
                    this.fillTimeValData(id, newLineNames, newLineIds, name);

                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }

                    index ++;
                }
                for(let i = 0; i < partObjVel.length; i++){ //iterate through velocity vector
                    use_timeWarp = false;
                    let partName = obj_name+"&"+part_obj_name+"&"+partObjVel[i];
                    id = partName +"&velocity";
                    console.log(id);
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!;
                    if(old_ind === -1 || filterChange){
                        if(partObjVel[i] === "magnitude")
                        {
                            let velocities = this.getVelocityVector(sceneId, obj.robot, part_obj.robotPart, use_timeWarp);
                            newTimes[index] = velocities[0];
                            newVals[index] = this.calculateMagitude(velocities[1], velocities[2], velocities[3]);
                        }
                        else {
                            let positions;
                            //fetch position data
                            let map_ind = jointPosMap.get(partObjVel[i]);
                            if (!map_ind) {
                                positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, false, partObjVel[i], use_timeWarp);
                            } else {
                                positions = [newTimes[map_ind], newVals[map_ind]]//TODO
                            }
                            //calculate velocity data
                            let changeInData = this.genChangeData(positions[0], positions[1]);
                            velocity_map.set(partName, this.genChangeData(positions[0], positions[1], 0));
                            newTimes[index] = changeInData[0];
                            newVals[index] = changeInData[1];
                        }
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }

                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${part_obj_name}_${partObjVel[i]}_Cartesian velocity${use_timeWarp?"_tw":""}`; 
                    this.fillTimeValData(id, newLineNames, newLineIds, name);

                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }

                    index ++;
                }
                for(let i = 0; i < partObjAcc.length; i++){ //iterate through acc vector
                    // log(obj_name);
                    use_timeWarp = false;
                    let partName = obj_name+"&"+part_obj_name+"&"+partObjAcc[i];
                    id = `${partName}&acceleration`;
                    // console.log(is_part_changed);
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!; 
                    if(old_ind === -1 || filterChange){
                        if(partObjAcc[i] === "magnitude")
                        {
                            let acc = this.getAccelerationVector(sceneId, obj.robot, part_obj.robotPart, use_timeWarp);
                            newTimes[index] = acc[0];
                            newVals[index] = this.calculateMagitude(acc[1], acc[2], acc[3]);
                        }
                        else
                        {
                            let velocities;
                            let vel = velocity_map.get(partName);
                            if (!vel) {
                                log("no cache for velocity " + partName);
                                let positions;
                                //fetch position data
                                let map_ind = jointPosMap.get(partObjAcc[i]);
                                if (!map_ind) {
                                    log("no index for position")
                                    positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, false, partObjAcc[i], use_timeWarp);
                                } else {
                                    log("has position")
                                    positions = [newTimes[map_ind], newVals[map_ind]]
                                }
                                log("computed velocity")
                                let changeInData = this.genChangeData(positions[0], positions[1], 0);
                                velocity_map.set(partName, changeInData);
                                velocities = [changeInData[0], changeInData[1]];
                            } else {
                                velocities = [vel[0], vel[1]];//[newTimes[map_ind], newVals[map_ind]]; //TODO
                            }

                            //calculate acceleration data
                            let changeInData = this.genChangeData(velocities[0], velocities[1]);
                            acceleration_map.set(partName, this.genChangeData(velocities[0], velocities[1], 0));
                            newTimes[index] = changeInData[0];
                            newVals[index] = changeInData[1];
                        }
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }
                    // jointAccMap.set(partObjAcc[i], index);//so that jerk graph do not need to regenerate data
    
                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${part_obj_name}_${partObjAcc[i]}_Cartesian acceleration${use_timeWarp?"_tw":""}`;
                    this.fillTimeValData(id, newLineNames, newLineIds, name);
    
                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }
                    index ++;
                }
                for(let i = 0; i < partObjJerk.length; i++){ //iterate through jerk vector
                    use_timeWarp = false;
                    // log(obj_name);
                    let partName =  obj_name+"&"+part_obj_name+"&"+partObjJerk[i];
                    id = `${partName}&jerk`;
                    if(!this.checkId({value: id}, is_part_changed, {value: use_timeWarp}))
                        continue;
                    let old_ind:number = is_part_changed.get(id)!; 
                    if(old_ind === -1 || filterChange){
                        if(partObjAcc[i] === "magnitude")
                        {
                            let jerk = this.getJerkVector(sceneId, obj.robot, part_obj.robotPart, use_timeWarp);
                            newTimes[index] = jerk[0];
                            newVals[index] = this.calculateMagitude(jerk[1], jerk[2], jerk[3]);
                        }
                        else
                        {
                            let accelerations;
                            let acc = acceleration_map.get(partName);
                            // if(!map_ind){
                            if (!acc) {
                                let velocities;
                                let vel = velocity_map.get(partName);
                                if (!vel) {
                                    let positions;
                                    //fetch position data
                                    let map_ind = jointPosMap.get(partObjJerk[i]);
                                    if (!map_ind) {
                                        positions = this.getPositions(sceneId, obj.robot, part_obj.robotPart, false, partObjJerk[i], use_timeWarp);
                                    } else {
                                        positions = [newTimes[map_ind], newVals[map_ind]]
                                    }
                                    let changeInData = this.genChangeData(positions[0], positions[1], 0);
                                    velocity_map.set(partName, changeInData);
                                    velocities = [changeInData[0], changeInData[1]];
                                } else {
                                    velocities = [vel[0], vel[1]];//[newTimes[map_ind], newVals[map_ind]];
                                }
                                let changeInData = this.genChangeData(velocities[0], velocities[1], 0);
                                acceleration_map.set(partName, changeInData);
                                accelerations = [changeInData[0], changeInData[1]];
                            } else {
                                accelerations = [acc[0], acc[1]];//[newTimes[map_ind], newVals[map_ind]];//TODO
                            }

                            //calculate acceleration data
                            let changeInData = this.genChangeData(accelerations[0], accelerations[1]);
                            newTimes[index] = changeInData[0];
                            newVals[index] = changeInData[1];
                        }
                    }else{
                        newTimes[index] = times[old_ind];
                        newVals[index] = values[old_ind];
                    }
    
                    is_part_changed.set(id, index);
                    name = `${rsmanager.robotSceneById(sceneId)?.name()}_${robotName}_${part_obj_name}_${partObjJerk[i]}_Cartesian jerk${use_timeWarp?"_tw":""}`;
                    this.fillTimeValData(id, newLineNames, newLineIds, name);
    
                    if(!newColorMap.has(id)){ //add to colormap if not in there
                        newColorMap.set(id, graph.getColor()); 
                    }
                    index ++;
                }
                
            }

        }

        times = newTimes;
        values = newVals;
        this.times = times;
        this.values = values;
        this.setState({
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            
            line_names: newLineNames,
            line_ids: newLineIds,
            color_map: newColorMap,
            refresh: false,
            is_part_changed: is_part_changed,
            need_update: false,
            velocity_map: velocity_map, 
            acceleration_map: acceleration_map
        });
        this.props.graph.setLineNames(newLineNames);
        this.props.graph.setLineIds(newLineIds);
        let line_colors = [];
        for (const l of newLineIds) {
            line_colors.push(newColorMap.get(l)!);
        }
        this.props.graph.setLineColors(line_colors);
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
        let eventNames: string[] = [];
        for(const line_id of graph.lineIds())
        {
            const [sceneId, robotName, partName, currSpeciProperty, currDataType] = this.decomposeEventName(line_id);
            let eventName = sceneId + "#" + robotName + "&" + partName;
            eventNames.push(eventName);
        }
        this.addNewLines(eventNames, graph.currProperty());
    }
    componentDidUpdate(prevProps:graph_panel_props) {
        let line = this.props.graph.deleteLine();
        if(line !== undefined)
        {
            const[robotName, partName, details, property] = line.split("&");
            if(this.state.currObjects.has(robotName + "&" + partName))
            {
                GraphPanel.removeRobotPartFromGraph(line, this.props.robotSceneManager);
                this.state.currObjects.delete(robotName + "&" + partName); // remove the object from the graph tab
                this.OnChangeGraph([line], false);
                this.props.graph.setDeleteLine(undefined, undefined);
            }
        }
        const {prev_times, refresh, need_update} = this.state;
        const timeBoundChange = (prev_times.start !== this.props.robotSceneManager.currStartTime() || 
            prev_times.end !== this.props.robotSceneManager.currEndTime());
        // log("in component did update, currEndTime is " + this.props.robotSceneManager.currEndTime());
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
        const currTimeChange = prev_times.curr !== this.props.robotSceneManager.currTime();
        if(currTimeChange || refresh || need_update) {
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
        // react to the updates in SelectionPanel
        const { eventName, add,} = this.props;
        const eventChnage = (eventName !== prevProps.eventName || add !== prevProps.add);
        if(eventChnage)
            this.onChangeGraphWithManyLines(eventName, add);

        // react to the updates in OptiontionPanel
        if(this.props.graph.filter() !== this.state.filter) {
            this.setState({
                filter: this.props.graph.filter(),
            });
            this.onChangeFilter(this.props.graph.filter());
        } 
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
        if (data === "position" || data === "velocity" || data === "acceleration" || data === "jerk") 
            currDataType = data;
        else
            throw Error(`${data} is not a property!!!!`);
        return currDataType;
    }

    /**
     * Handle changing a graph with multiple lines
     * @param eventName // the name of the event with 
     * a format of "sceneId#robotName&partName&currSpeciProperty&currDataType"
     * @param add // whether to add lines or delete lines
     * @returns 
     */
    onChangeGraphWithManyLines(eventName:string[], add:boolean)
    {
        this.setState({
            currProperty: eventName[0],
        })
        this.state.graph_list.clear(); // delete all current lines
        this.props.graph.resetColor(); // reset all colors
        this.state.color_map.clear();
        this.state.is_part_changed.clear();
        let lines = [];
        let properties = processProperties(eventName[0]);
        for(const object of this.state.currObjects)
            lines.push(object + properties);
        this.OnChangeGraph(lines, add);
    }
    /**
     * Handle changing a graph
     * @param eventNames // a string of the name of the event with 
     * a format of "sceneId#robotName&partName&currSpeciProperty&currDataType"
     * @param add // whether to add lines or delete lines
     * @returns 
     */
    OnChangeGraph(eventNames:string[], add:boolean)
    {
      for(const eventName of eventNames)
        this.OnChangeGraphHelper(eventName, add);
        this.fillGraphData();
    }
    /**
     * Handle changing a graph with one line
     * @param eventName // the name of the event with 
     * a format of "sceneId#robotName&partName&currSpeciProperty&currDataType"
     * @param add // whether to add lines or delete lines
     * @returns 
     */
    OnChangeGraphHelper(eventName:string, add:boolean){
        console.log("on change graph called in GraphPanel");
        console.log("event name is " + eventName);
        const contents = this.decomposeEventName(eventName);
        const rsmanager = this.props.robotSceneManager;
        const currScene = rsmanager.robotSceneById(contents[0]);
        if(currScene == undefined) return;
        console.log("scene id is " + contents[0]);
        const robotName = contents[1];
        if (robotName == undefined) return;
        console.log("robot name is " + robotName);
        const partName = contents[2];
        if(partName == undefined) return;
        console.log("part name is " + partName);
        const currSpeciProperty = contents[3];
        if(currSpeciProperty == undefined) return;
        console.log("current specific prop is " + currSpeciProperty);
        if(contents[4] === "rotation") return;
        const currDataType = this.convertStringToDataType(contents[4]);
        if(currDataType == undefined) return;
        console.log("current data type is " + currDataType);
        const name = contents[0] + "#"+ robotName;
        
        let {
          graph_list,
          is_part_changed,
          //line_ids,
          use_timeWarp,
        } = this.state;
        let {line_ids} = this.state;
        const sceneId = currScene.id().value();
        let robotObj = graph_list.get(name);
       // let eventName = sceneId + "#" + robotName + "&" + partName + "&" + currSpeciProperty + "&" + currDataType;
       
        if(use_timeWarp){
            eventName += "&tw";
        }
        if(line_ids.includes(eventName)){
            is_part_changed.set(eventName, line_ids.indexOf(eventName));
        }else{
            is_part_changed.set(eventName, -1);
        }
        if(!add){
            // const name = `${currScene.name()}_${robotName}_${partName}_${currSpeciProperty}_${currDataType}${use_timeWarp?"_tw":""}`;
            is_part_changed.delete(eventName);
            // console.log("color is " + this.state.color_map.get(eventName));
            this.state.color_map.delete(eventName);
        }
        //if robotname found
        //  if partName can be found
        //      check if param is already on, if not add it, if so delete it
        //  else create part obj and add param
        //else create obj and part obj and add param
        // if (partName === "all") {
        //   is_part_changed.delete(eventName); //delete id in map, since it's not a valid id
        //   if (!robotObj) {
        //     let robot = GraphPanel.getRobotByName(
        //       rsmanager.robotSceneById(sceneId)! /*this.props.robotScene*/,
        //       robotName
        //     );
        //     if (!robot) {
        //       log(`robot name cannot be found`);
        //       return;
        //     }
        //     //define new robotObj
        //     robotObj = {
        //       robotScene: sceneId,
        //       robot: robot,
        //       position_type: [], //for relative position of whole robot
        //       velocity_type: [],
        //       acceleration_type: [],
        //       jerk_type: [],
        //       robotParts: new Map<string, graph_part_obj>(), //key = robot part id
        //     };
        //   }
        //   const isAll = this.isAllJoints(
        //     robotObj.robot,
        //     robotObj.robotParts,
        //     currSpeciProperty,
        //     currDataType
        //   );
        //   let robotParts = robotObj.robotParts;
        //   for (const [jointName, joint] of robotObj.robot.jointMap()) {
        //     let obj = robotParts.get(jointName);
        //     let id = name + "&" + jointName + "&" + currSpeciProperty + "&" + currDataType;

        //     if(add){
        //         if(line_ids.includes(id)){
        //             is_part_changed.set(id, line_ids.indexOf(eventName));
        //         }else{
        //             is_part_changed.set(id, -1);
        //         }
        //     }else{
        //         is_part_changed.delete(id);
        //     }
        //     if (obj) {
        //       if (currSpeciProperty === "angle") {
        //         if (currDataType === "position") {
        //           obj.angle[0] = !isAll;
        //         } else if (currDataType === "velocity") {
        //           obj.angle[1] = !isAll;
        //         } else if (currDataType === "acceleration") {
        //           obj.angle[2] = !isAll;
        //         } else if (currDataType === "jerk") {
        //           obj.angle[3] = !isAll;
        //         }
        //       } else if (currSpeciProperty === "x" ||
        //         currSpeciProperty === "y" ||
        //         currSpeciProperty === "z"
        //       ) {
        //         let keys;
        //         if (currDataType === "position") {
        //           keys = obj.position_type;
        //         } else if (currDataType === "velocity") {
        //           keys = obj.velocity_type;
        //         } else if (currDataType === "acceleration") {
        //           keys = obj.acceleration_type;
        //         } else if (currDataType === "jerk") {
        //           keys = obj.jerk_type;
        //         } else {
        //           log("Error: Checkbox invalid data type: " + currDataType);
        //           return;
        //         }
        //         let index = keys.indexOf(currSpeciProperty);
        //         if (index !== -1) {
        //           if (isAll) {
        //             keys.splice(index, 1); //remove key only if isAll
        //           }
        //         } else {
        //           keys.push(currSpeciProperty);
        //         }
        //         keys.sort();
        //         if (currDataType === "position") {
        //           obj.position_type = keys;
        //         } else if (currDataType === "velocity") {
        //           obj.velocity_type = keys;
        //         } else if (currDataType === "acceleration") {
        //           obj.acceleration_type = keys;
        //         } else if (currDataType === "jerk") {
        //           obj.jerk_type = keys;
        //         }
        //       }
        //       if (
        //         obj.position_type.length === 0 &&
        //         obj.velocity_type.length === 0 &&
        //         obj.acceleration_type.length === 0 &&
        //         obj.jerk_type.length === 0 &&
        //         !this.booleanSum(obj.angle)
        //       ) {
        //         //can delete obj
        //         robotParts.delete(jointName);
        //       }
        //     } else {
        //       obj = {
        //         robotPart: joint,
        //         position_type:
        //           currDataType === "position"
        //             ? currSpeciProperty === "x" ||
        //               currSpeciProperty === "y" ||
        //               currSpeciProperty === "z" ||
        //               currSpeciProperty === "magnitude" 
        //               ? [currSpeciProperty]
        //               : []
        //             : [],
        //         velocity_type:
        //           currDataType === "velocity"
        //             ? currSpeciProperty === "x" ||
        //               currSpeciProperty === "y" ||
        //               currSpeciProperty === "z" ||
        //               currSpeciProperty === "magnitude" 
        //               ? [currSpeciProperty]
        //               : []
        //             : [],
        //         acceleration_type:
        //           currDataType === "acceleration"
        //             ? currSpeciProperty === "x" ||
        //               currSpeciProperty === "y" ||
        //               currSpeciProperty === "z" ||
        //               currSpeciProperty === "magnitude" 
        //               ? [currSpeciProperty]
        //               : []
        //             : [],
        //         jerk_type:
        //           currDataType === "jerk"
        //             ? currSpeciProperty === "x" ||
        //               currSpeciProperty === "y" ||
        //               currSpeciProperty === "z" ||
        //               currSpeciProperty === "magnitude" 
        //               ? [currSpeciProperty]
        //               : []
        //             : [],
        //         angle: [
        //           currDataType === "position" && currSpeciProperty === "angle",
        //           currDataType === "velocity" && currSpeciProperty === "angle",
        //           currDataType === "acceleration" &&
        //             currSpeciProperty === "angle",
        //           currDataType === "jerk" && currSpeciProperty === "angle",
        //         ],
        //       };
        //     }

        //     robotParts.set(jointName, obj);
        //   }
        //   robotObj.robotParts = robotParts;

        //   if (
        //     !robotObj.robotParts.size &&
        //     !robotObj.position_type.length &&
        //     !robotObj.velocity_type.length &&
        //     !robotObj.acceleration_type.length &&
        //     !robotObj.jerk_type.length
        //   ) {
        //     // if robot has nothing checked
        //     graph_list.delete(name);
        //   } else {
        //     graph_list.set(name, robotObj);
        //     console.log("name is " + name);
        //     console.log(robotObj);
        //   }
        // } else 
        if (robotObj) {
          // robot object exists
          let obj = robotObj.robotParts.get(partName);
          if (obj) {
            //partName found in current graph list
            if (currSpeciProperty === "angle") {
              // update the angle variable according to the current data type
              if (currDataType === "position") {
                obj.angle[0] = !obj.angle[0];
              } else if (currDataType === "velocity") {
                obj.angle[1] = !obj.angle[1];
              } else if (currDataType === "acceleration") {
                obj.angle[2] = !obj.angle[2];
              } else if (currDataType === "jerk") {
                obj.angle[3] = !obj.angle[3];
              }
            } else if (
              currSpeciProperty === "x" ||
              currSpeciProperty === "y" ||
              currSpeciProperty === "z" ||
              currSpeciProperty === "magnitude" 
            ) {
              // update the type arrays according to the data type
              let keys;
              if (currDataType === "position") {
                keys = obj.position_type;
              } else if (currDataType === "velocity") {
                keys = obj.velocity_type;
              } else if (currDataType === "acceleration") {
                keys = obj.acceleration_type;
              } else if (currDataType === "jerk") {
                keys = obj.jerk_type;
              } else {
                log("Error: Checkbox invalid data type: " + currDataType);
                return;
              }
              let index = keys.indexOf(currSpeciProperty);
              if (index !== -1) {
                //found currSpeciProperty
                keys.splice(index, 1);
              } else {
                keys.push(currSpeciProperty);
              }
              keys.sort(); // each type array should be sorted
              if (currDataType === "position") {
                obj.position_type = keys;
              } else if (currDataType === "velocity") {
                obj.velocity_type = keys;
              } else if (currDataType === "acceleration") {
                obj.acceleration_type = keys;
              } else if (currDataType === "jerk") {
                obj.jerk_type = keys;
              }
            }
            if (
              !obj.angle &&
              !obj.position_type.length &&
              !obj.velocity_type.length &&
              !obj.acceleration_type.length &&
              !obj.jerk_type.length
            ) {
              // if robot part has nothing checked
              robotObj.robotParts.delete(partName);
            } else {
              robotObj.robotParts.set(partName, obj);
            }
          } else {
            //create part obj and add currSpeciProperty
            let robotPart: robotPartType;
            if (
              robotObj.robot.jointMap().size === 0 &&
              robotObj.robot.linkMap().size === 0
            )
              robotPart = undefined;
            else {
              robotPart = robotObj.robot.jointMap().get(partName);
              if (!robotPart) {
                robotPart = robotObj.robot.linkMap().get(partName);
                if (!robotPart) {
                  log(`Error: robot joint name cannot be found`);
                  return;
                }
              }
            }
            let obj: graph_part_obj = {
              robotPart: robotPart,
              position_type:
                currDataType === "position"
                  ? currSpeciProperty === "x" ||
                    currSpeciProperty === "y" ||
                    currSpeciProperty === "z" ||
                    currSpeciProperty === "magnitude" 
                    ? [currSpeciProperty]
                    : []
                  : [],
              velocity_type:
                currDataType === "velocity"
                  ? currSpeciProperty === "x" ||
                    currSpeciProperty === "y" ||
                    currSpeciProperty === "z" ||
                    currSpeciProperty === "magnitude" 
                    ? [currSpeciProperty]
                    : []
                  : [],
              acceleration_type:
                currDataType === "acceleration"
                  ? currSpeciProperty === "x" ||
                    currSpeciProperty === "y" ||
                    currSpeciProperty === "z" ||
                    currSpeciProperty === "magnitude" 
                    ? [currSpeciProperty]
                    : []
                  : [],
              jerk_type:
                currDataType === "jerk"
                  ? currSpeciProperty === "x" ||
                    currSpeciProperty === "y" ||
                    currSpeciProperty === "z" ||
                    currSpeciProperty === "magnitude" 
                    ? [currSpeciProperty]
                    : []
                  : [],
              angle: [
                currDataType === "position" && currSpeciProperty === "angle",
                currDataType === "velocity" && currSpeciProperty === "angle",
                currDataType === "acceleration" &&
                  currSpeciProperty === "angle",
                currDataType === "jerk" && currSpeciProperty === "angle",
              ],
            };
            robotObj.robotParts.set(partName, obj);
          }
          if (
            !robotObj.robotParts.size &&
            !robotObj.position_type.length &&
            !robotObj.velocity_type.length &&
            !robotObj.acceleration_type.length &&
            !robotObj.jerk_type.length
          ) {
            // if robot has nothing checked
            graph_list.delete(name);
          } else {
            graph_list.set(name, robotObj);
          }
        } else {
          // part obj not found. create part obj and add currSpeciProperty
          let robot = GraphPanel.getRobotByName(
            rsmanager.robotSceneById(sceneId)! /*this.props.robotScene*/,
            robotName
          );
          if (!robot) {
            log(`Error: robot name cannot be found`);
            return;
          }
          //define new robotObj
          let robotObj: graph_obj = {
            robotScene: sceneId,
            robot: robot,
            position_type: [], //for relative position of whole robot
            velocity_type: [],
            acceleration_type: [],
            jerk_type: [],
            robotParts: new Map<string, graph_part_obj>(), //key = robot part id
          };
          let robotPart: robotPartType;
          if (
            robotObj.robot.jointMap().size === 0 &&
            robotObj.robot.linkMap().size === 0
          )
            robotPart = undefined;
          else {
            robotPart = robotObj.robot.jointMap().get(partName);
            if (!robotPart) {
              robotPart = robotObj.robot.linkMap().get(partName);
              if (!robotPart) {
                log(`Error: robot joint name cannot be found`);
                return;
              }
            }
          }
          
          let obj: graph_part_obj = {
            robotPart: robotPart,
            position_type:
              currDataType === "position"
                ? currSpeciProperty === "x" ||
                  currSpeciProperty === "y" ||
                  currSpeciProperty === "z" ||
                  currSpeciProperty === "magnitude" 
                  ? [currSpeciProperty]
                  : []
                : [],
            velocity_type:
              currDataType === "velocity"
                ? currSpeciProperty === "x" ||
                  currSpeciProperty === "y" ||
                  currSpeciProperty === "z" ||
                  currSpeciProperty === "magnitude" 
                  ? [currSpeciProperty]
                  : []
                : [],
            acceleration_type:
              currDataType === "acceleration"
                ? currSpeciProperty === "x" ||
                  currSpeciProperty === "y" ||
                  currSpeciProperty === "z" ||
                  currSpeciProperty === "magnitude" 
                  ? [currSpeciProperty]
                  : []
                : [],
            jerk_type:
              currDataType === "jerk"
                ? currSpeciProperty === "x" ||
                  currSpeciProperty === "y" ||
                  currSpeciProperty === "z" ||
                  currSpeciProperty === "magnitude" 
                  ? [currSpeciProperty]
                  : []
                : [],
            angle: [
              currDataType === "position" && currSpeciProperty === "angle",
              currDataType === "velocity" && currSpeciProperty === "angle",
              currDataType === "acceleration" && currSpeciProperty === "angle",
              currDataType === "jerk" && currSpeciProperty === "angle",
            ],
          };
          robotObj.robotParts.set(partName, obj);
          graph_list.set(name, robotObj);
        }

        this.setState({
          graph_list: graph_list,
          is_part_changed: is_part_changed,
          graph_update: true, //need to update graph axis since some selection is added/removed
        });
        // console.log(this.state.is_part_changed);
        // console.log(this.state.graph_list);
        // this.fillGraphData();
        return;
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
    onChangeFilter(e:number){
        console.log("on change filter");
        this.setState({
            filter: e,
            graph_update: true,
        });
        this.fillGraphData(false, false, true);
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
        const[robotName, partName, details, property] = line.split("&");
        this.state.currObjects.delete(robotName + "&" + partName); // remove the object from the graph tab
        this.OnChangeGraph([line], false);
    }

    static removeRobotPartFromGraph(line_id: string, robotSceneManager: RobotSceneManager) {
        let [sceneId, contents] = line_id.split("#");
        let [robotName, partName, ,] = contents.split("&");
        let scene = robotSceneManager.robotSceneById(sceneId);
        if (scene !== undefined) {
            let robotPart: RobotJoint | RobotLink | undefined = scene.getJointByName(robotName, partName);
            if (robotPart === undefined)
                robotPart = scene.getLinkByName(robotName, partName);
            if (robotPart !== undefined)
                robotPart.removeFromGraph();
            else
            {
                let robot = scene.getRobotByName(robotName);
                if(robot !== undefined) robot.removeFromGraph();
            }
            APP.render();
            APP.updateUI();
            console.log(robotPart);
        }
    }
    /**
     * Handle selecting a line as line1 or line2 in difference graph
     * @param line in a format of "sceneId#robotName&partName&currSpeciProperty&currDataType"
     * @param index 0 or 1, 0 means line1, 1 means line2
     */
    // onSelectLine(line: string, index: number) {
    //     console.log("select " + line);
    //     let newDiff_line_ids = [...this.props.diff_line_ids_prop];
    //     newDiff_line_ids[index] = line;
    //     this.props.updateGraphPanelState(undefined, undefined,undefined,undefined, undefined, newDiff_line_ids, undefined, undefined, undefined);
    // }
    
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
        let eventName = event.dataTransfer.getData("text/plain");
        this.addNewLines([eventName], this.state.currProperty);
    }

    addNewLines(eventNames: string[], currProperty: string)
    {
        let properties = processProperties(currProperty);
        const {currObjects} = this.state;
        let lines: string[] = [];
        for (const eventName of eventNames) {
            if (!currObjects.has(eventName))
                currObjects.add(eventName);
            else continue; // no need to draw the objects that are already in the graph
            const [sceneId, robotName, partName] = this.decomposeId(eventName);
            const { robotSceneManager } = this.props;
            let scene = robotSceneManager.robotSceneById(sceneId);
            if (scene !== undefined) {
                if (!robotSceneManager.isActiveRobotScene(scene))
                    robotSceneManager.activateRobotScene(scene);
                let robotPart: RobotJoint | RobotLink | undefined = scene.getJointByName(robotName, partName);
                if (robotPart === undefined)
                    robotPart = scene.getLinkByName(robotName, partName);
                if (robotPart !== undefined)
                    robotPart.addToGraph();
                else {
                    let robot = scene.getRobotByName(robotName);
                    if (robot !== undefined) robot.addToGraph();
                }
            }
            lines.push(eventName + properties);
        }
        if(lines.length > 0)
            this.OnChangeGraph(lines, true);
    }

    /**
     * handle the click of the Graph Panel
     * update the id of currently selected panel
     */
    clickHandler = (event: any) => {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        
        this.props.graph.setCurrProperty(this.state.currProperty);
        this.props.robotSceneManager.setCurrGraph(this.props.graph.id());
        this.props.setGraphOptionPanelActive();
    };
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
    // check if time has changed in render manually
    render() {
      const times = this.times;
      const values = this.values;
      const {color_map,
        is_part_changed,
        prev_times,
        panelHeight,
        panelWidth,
        currProperty,
        line_names, line_ids
      } = this.state;
      let line_colors: string[] = [];
      for (const l of line_ids) {
        line_colors.push(color_map.get(l)!);
        //translate line_names to readable names
      }

      const [,detail, property] = currProperty.split("&");
      let title = property + " in " + detail;
      if(property === "rotation")
        title = "the rotation can only be shown in difference";
      if(property.startsWith("joint"))
        title = property;
      let selected:boolean = (this.props.robotSceneManager.getCurrGraph() === this.props.graph);
      return (
        <div
          className={"GraphPanel"}
          ref={this._graphDiv}
          onDrop={this.dropHandler.bind(this)}
          onDragOver={this.dragOverHandler.bind(this)}
          onClick={this.clickHandler.bind(this)}
          style={{backgroundColor: this.props.graph.backgroundColor()}}
        >
              <div className="LegendMessage">
                  <DragButton
                      buttonValue={"Legend"}
                      className={"Legend"}
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
                  <div className="PopUpGroup">
                    <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.GraphPanel)}>
                        <FontAwesomeIcon className="Icon" icon={faQuestion} />
                    </button>
                  </div>
              </div>
            
          {
            <LineGraph
              times={times}
              vals={values}
              startTime={prev_times.start}
              endTime={prev_times.end}
              currTime={prev_times.curr}
              isZoom={false}
              isDiff={false}
              isTimeWarp={false}
              line_names={line_names}
              line_colors={line_colors}
              title={title}
              width={panelWidth}
              height={panelHeight}
              line_ids={line_ids}
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