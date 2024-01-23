import React, { Component, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { DragButton } from "../DragButton";
import { UMAP } from "umap-js";
import { UmapLineGraph } from "../UmapLineGraph";
import { UmapGraph } from "../../objects3D/UmapGraph";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import assert from "assert";
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";

// import { time } from "console";
//TODO timewarped positions graph
export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    graph: UmapGraph,
    isTimeWarp: boolean,
    getParentDockLayout: () => DockLayout | undefined,
    force_update: boolean,
    setUmapGraphOptionPanelActive: () => void,
}

interface graph_panel_state {
    counter:number,
    prev_times: time_obj, //previous "current times" used for componentDidUpdate
    use_timeWarp: boolean, // whether to use timewarped data instead of raw data
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of names of lines graphed
    line_colors: string[],
    color_map: Map<string, string>, //map line name to color
    currRobots: Map<string, [number[], number[][]]>, // map the eventName to their umap data
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    need_update: boolean // need to update graph data to trigger fillGraphData
    graph_update: boolean // need to update graph->sent to LineGraph components when lines are added or removed, so axis and lines need regeneration
    nNeighbors: number; // the number of neighbors when calculating umap
    minDis: number; // the min distance when calculating umap
    spread: number; // the spread when calculating umap
}

export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export interface umap_data_entry {
    x: number,
    y: number
}
export class UmapGraphPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;

    // times and values are states at first
    // but the setState function cannot update the state immediately
    protected times: number[][]; // times[i] is the array of times for line i
    protected xVals: number[][]; // values[i] is the array of values for line i
    protected yVals: number[][]; // values[i] is the array of values for line i

    constructor(props: graph_panel_props) {
        
        super(props);
        this.fillGraphData.bind(this);
        const rsmanager = this.props.robotSceneManager;
        this.state = {
            counter: 0,
            line_names: [], //list of names of lines graphed
            line_ids: [], //list of names of lines graphed
            line_colors: [],
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            use_timeWarp: false,
            color_map: new Map<string, string>(),
            currRobots: new Map(),
            panelHeight: 200,
            panelWidth: 300,
            need_update: true,
            graph_update: false,
            nNeighbors: this.props.graph.nNeighbors(),
            minDis: this.props.graph.minDis(),
            spread: this.props.graph.spread(),
        };
        this._graphDiv = createRef();
        this.times = [];
        this.xVals = [];
        this.yVals = [];
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
     * Return positions for the articulated joints throughout the entire time frame
     * @param robot 
     * @param robotPart 
     * @param isWarped if true, then generate warped data, if null then raw data
     * @returns 
     */
    getAllArticulatedJointsPositions(robotScene: RobotScene, robot: Robot, isWarped?:boolean):[number[], number[][]]{
        const rsmanager = this.props.robotSceneManager;
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
      
        let result: number[][] = [];
        let times: number[] = [];
        let jointDatas = [];
        for(const [,robotPart] of robot.getArticuatedJointMap())
        {
            let data = robotScene.frameDataFor(robot, timeRange, robotPart);
            jointDatas.push(data.jointAngles);
            times = data.times;
        }

        if(jointDatas.length > 0)
        {
            for(let i=0; i<jointDatas[0].length; i++)
            {
                let joints = [];
                for(let j=0; j<jointDatas.length; j++)
                    joints.push(jointDatas[j][i]);
                result.push(joints);
            }
        }
        
        return [times, result];
    }

    async convertJointDataToUmap(jointData: number[][]): Promise<number[][]>
    {
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, type: "UMAP" });
        //await Promise.all([]);
        const {graph} = this.props;
        const umap = new UMAP({nNeighbors: graph.nNeighbors(), minDist: graph.minDis(), spread: graph.spread()});

        // for (let i = 0; i < 1000; i++) {
        //     let a = Array(jointData[0].length).fill(Math.random() * Math.PI * 2 - Math.PI);
        //     jointData.push(a);
        // }
        
        //const embedding = umap.fit(jointData);
        const embedding = await umap.fitAsync(jointData, epochNumber => {
            // check progress and give user feedback, or return `false` to stop
          });
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess, type: "UMAP"});
        return embedding;
    }
   

    /**
     * given the eventName (line id), generate the line names that will be shown in the legend
     * @param eventName 
     * @returns 
     */
    generateLineName(eventName: string)
    {
        const[sceneId, robotName] = this.decomposeId(eventName);
        const {robotSceneManager} = this.props;
        let scene = robotSceneManager.robotSceneById(sceneId);
        return scene?.name() + "_" + robotName;
    }

    decomposeUmapData(umapData: number[][]): [number[], number[]]
    {
        let x = [], y = [];
        for(let i=0; i<umapData.length; i++)
        {
            x.push(umapData[i][0]);
            y.push(umapData[i][1]);
        }
        return [x, y];
    }

    /**
     * compare two joint data
     * @param d1 
     * @param d2 
     * @returns true if two data arrays are the same
     */
    compareJointData(d1: number[], d2: number[]): boolean
    {
        if(d1.length !== d2.length) return false;
        for(let i=0; i<d1.length; i++)
            // if(d1[i] !== d2[i]) return false;
            if (Math.abs(d1[i] - d2[i]) > 0.01) return false;
        return true;
    }

    /**
     * filter the umap data based on joint data
     * make sure that the umapdata is the same if jointdata is the same
     * @param jointData 
     * @param umapData 
     * @returns 
     */
    filterUmapData(jointData: number[][], umapData: number[][]): number[][]
    {
        for(let i=1; i<jointData.length; i++)
        {
            if(this.compareJointData(jointData[i-1], jointData[i]))
            {
                umapData[i] = umapData[i-1];
            }
        }
        return umapData;
    }
    
    /**
     * filter the joint data
     * @param jointData 
     * @returns 
     */
    filterJointData(jointData: number[][], times: number[] ): [number[][], number[]]
    {
        let resultJointData: number[][] = [];
        let resultTimes: number[] = [];
        for(let i=0; i<jointData.length; i++)
        {
            if(i === 0 || !this.compareJointData(jointData[i-1], jointData[i]))
            {
                resultJointData.push(jointData[i]);
                resultTimes.push(times[i]);
            }
        }
        return [resultJointData, resultTimes];
    }

    /**
     * fill graph data
     */
    async fillGraphData(): Promise<void> {
        const { currRobots, color_map } = this.state;
        let line_names = [], line_ids = [], line_colors = [];
        let xVals = [];
        let yVals = [];
        let _times = [];
        let filteredJointData: number[][] = [];
        let filteredTimes: number[][] = [];
        let lengths: number[] = [];

        for (const [eventName, [times, jointData]] of currRobots) {
            let [filteredData, filteredTime] = this.filterJointData(jointData, times);
            filteredJointData = filteredJointData.concat(filteredData);
            filteredTimes.push(filteredTime);
            assert(filteredData.length === filteredTime.length);
            lengths.push(filteredData.length);
        }
        if (filteredJointData.length !== 0) {
            //APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, type: "umap" });
            let umapData = await this.convertJointDataToUmap(filteredJointData);
            //APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess, type: "umap"});
            let index: number = 0;
            let robotIndex: number = 0;
            for (const [eventName, [times, jointData]] of currRobots) {
                line_names.push(this.generateLineName(eventName));
                line_ids.push(eventName);
                line_colors.push(color_map.get(eventName)!);
                let currUmap = umapData.slice(index, index + lengths[robotIndex]);
                let [filteredX, filteredY] = this.decomposeUmapData(currUmap);
                assert (filteredX.length === lengths[robotIndex]);
                assert (filteredY.length === lengths[robotIndex]);

                let j = 0;
                let x: number[] = []; 
                let y: number[] = [];
                let t: number[] = [];
                for (let i = 0; i < times.length; i++) {
                    if (j+1 < filteredTimes[robotIndex].length && times[i] >= filteredTimes[robotIndex][j+1]) {
                        j++;
                    }
                    x.push(filteredX[j]);
                    y.push(filteredY[j]);
                    t.push(times[i]);
                }

                xVals.push(x);
                yVals.push(y);
                _times.push(times);

                index = index + lengths[robotIndex];
                robotIndex++;
            }
        }
        this.xVals = xVals;
        this.yVals = yVals;
        this.times = _times;
        this.props.graph.setLineNames(line_names);
        this.props.graph.setLineIds(line_ids);
        this.props.graph.setLineColors(line_colors);
        this.setState({
            line_names: line_names,
            line_colors: line_colors,
            line_ids: line_ids,
            need_update: false,
        })
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
                panelHeight: (entries[0].contentRect.height) * 0.9,
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
            const [sceneId, robotName] = this.decomposeId(line_id);
            let eventName = sceneId + "#" + robotName;
            this.changeLines(eventName, true);
            eventNames.push(eventName);
        }
    }
    componentDidUpdate(prevProps:graph_panel_props) {
        let line = this.props.graph.deleteLine();
        if(line !== undefined)
        {
            if(this.state.currRobots.has(line))
            {
                this.state.currRobots.delete(line); // remove the object from the graph tab
                this.changeLines(line, false);
                this.props.graph.setDeleteLine(undefined, undefined);
            }
        }

        if(this.props.graph.nNeighbors() !== this.state.nNeighbors 
        || this.props.graph.minDis() !== this.state.minDis 
        || this.props.graph.spread() !== this.state.spread){
            this.setState({
                nNeighbors: this.props.graph.nNeighbors(),
                minDis: this.props.graph.minDis(),
                spread: this.props.graph.spread(),
            });
            this.props.graph.resetColor();
            this.fillGraphData();
        }

        const {prev_times, need_update} = this.state;
        const timeBoundChange = (prev_times.start !== this.props.robotSceneManager.currStartTime() || 
            prev_times.end !== this.props.robotSceneManager.currEndTime());
        // log("in component did update, currEndTime is " + this.props.robotSceneManager.currEndTime());
        const currTimeChange = prev_times.curr !== this.props.robotSceneManager.currTime();

        if(timeBoundChange || currTimeChange)
        {
            this.setState({
                prev_times: {
                    start: this.props.robotSceneManager.currStartTime(),
                    end: this.props.robotSceneManager.currEndTime(),
                    curr: this.props.robotSceneManager.currTime()
                },
            })
        }

        // if(currTimeChange ||
        //     // refresh ||
        //     // clear ||
        //     need_update
        //     ) {
        //     // log("Updating states in componentDidUpdate");
        //     this.fillGraphData();
        // }

        // Note: force_update updates all the graphs, not just selected one
        const{force_update} = this.props;
        const force_updateChnage = force_update !== prevProps.force_update;
        if (force_updateChnage)
            this.setState({
                need_update: true
            });
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
     * handle the change of lines
     * @param eventName // the line id
     * @param add true if add a line, false if delete a line
     * @returns 
     */
    changeLines(eventName: string, add: boolean)
    {
        if(this.state.currRobots.has(eventName)) return;
        const[sceneId, robotName] = this.decomposeId(eventName);
        const {robotSceneManager} = this.props;
        let scene = robotSceneManager.robotSceneById(sceneId);
        if(scene === undefined) return;
        if(!robotSceneManager.isActiveRobotScene(scene))
            robotSceneManager.activateRobotScene(scene);
        let robot = scene.getRobotByName(robotName);
        if(robot === undefined) return;
        if (add) {
            let [times, jointData] = this.getAllArticulatedJointsPositions(scene, robot);
            this.state.currRobots.set(eventName, [times, jointData]);
            this.state.color_map.set(eventName, this.props.graph.getColor());
        }
        else
        {
            this.state.currRobots.delete(eventName);
            this.state.color_map.delete(eventName);
        }
        
        this.fillGraphData();
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
    
        this.changeLines(eventName, true);
    }

    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param eventName
     * @returns 
     */
    decomposeId(eventName:string)
    {
        const [sceneId, robotName] = eventName.split("#");
        return [sceneId, robotName];
    }
    /**
     * handle the click of the Difference Graph Panel
     * update the id of currently selected panel
     */
    clickHandler = () => {
        // console.log(`Clicked on GraphPanel. the key is ` + this.props.graphKey);
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._graphDiv.current?.classList.add('selected');
        
        // console.log(`Clicked on GraphPanel. the key is ` + this.props.graphKey);
        this.props.robotSceneManager.setCurrUmapGraph(this.props.graph.id());
        this.props.setUmapGraphOptionPanelActive();
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

    // check if time has changed in render manually
    render() {
        const {line_names, line_ids, line_colors,
           use_timeWarp,color_map, prev_times,
            panelHeight, panelWidth,} = this.state;
        const isTimeWarp = this.props.isTimeWarp;
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
                                `UmapLegend&${newID(4)}&${this.props.graph.id()}`,

                                // onDrop Callback
                                (e) => {
                                },
                            ];
                        }}
                    />
                    <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.UmapGraphPanel)}>
                        <FontAwesomeIcon className="Icon" icon={faQuestion} />
                    </button>
                </div>
            <UmapLineGraph
              times={this.times}
              xVals={this.xVals}
              yVals={this.yVals}
              startTime={prev_times.start}
              endTime={prev_times.end}
              currTime={prev_times.curr}
              isTimeWarp={false}
              line_names={line_names}
              line_colors={line_colors}
              width={panelWidth}
              height={panelHeight}
              line_ids={line_ids}
              selected={this.props.robotSceneManager.getCurrUmapGraph() === this.props.graph}
              lineWidth={this.props.graph.lineWidth()}
              axisColor={this.props.graph.axisColor()}
              onGraphUpdate={this.onGraphUpdate.bind(this)}
              onCurrChange={this.onCurrTimeChange.bind(this)}
              onStartChange={this.onStartTimeChange.bind(this)}
              onEndChange={this.onEndTimeChange.bind(this)}
            />
          </div>
        );
    }
}