import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { newID } from "../../helpers";
import { LineGraph } from "../LineGraph";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { DragButton } from "../DragButton";
import { Graph } from "../../objects3D/Graph";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";

//TODO timewarped positions graph
export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    robotScene?: RobotScene,
    isTimeWarp: boolean,
    force_update: boolean,
    getParentDockLayout: () => DockLayout | undefined,
    graph: Graph,
    setGraphOptionPanelActive: () => void,
}

interface graph_panel_state {
    counter:number,
    //times: number[][], // times[i] is the array of times for line i
    //values: number[][], // values[i] is the array of values for line i
    zoomed_times: number[][],
    zoomed_values: number[][],
    prev_times: time_obj, //previous "current times" used for componentDidUpdate
    show_zoomed: boolean,
    refresh: boolean, // whether to refresh the data or not
    clear: boolean, // whether to clear the options or not
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of names of lines graphed
    color_map: Map<string, string>, //map line name to color
    currScene: RobotScene | undefined,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer and need line generation(data and graph)
    need_update: boolean // need to update graph data to trigger fillGraphData
    graph_update: boolean // need to update graph->sent to LineGraph components when lines are added or removed, so axis and lines need regeneration
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export class TimeWarpGraphPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;

    // times and values are states at first
    // but the setState function cannot update the state immediately
    protected times: number[][]; // times[i] is the array of times for line i
    protected values: number[][]; // values[i] is the array of values for line i

    constructor(props: graph_panel_props) {
        
        super(props);
        this.fillGraphData.bind(this);
        const rsmanager = this.props.robotSceneManager;
        this.state = {
            counter: 0,
            //times: [],
            //values: [],
            zoomed_times: [],
            zoomed_values: [],
            prev_times: {
                start: rsmanager.currStartTime(),
                end: rsmanager.currEndTime(),
                curr: rsmanager.currTime()
            },
            show_zoomed: false,
            line_names: [],
            line_ids: [],
            color_map: new Map<string, string>(),
            refresh: false,
            clear: false,
            currScene: undefined/*this.props.robotScene*/,
            panelHeight: 200,
            panelWidth: 300,
            need_update: true,
            graph_update: false,
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
    interpolate(startTime: number, currTime: number, endTime: number, startValue: number, endValue: number): number
    {
        if(endTime === startTime) return endValue;
        let ratio = (currTime - startTime) / (endTime - startTime);
        return ratio * endValue + (1-ratio) * startValue; 
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
        console.log("fill graph data is called");
        const {
            /*times, values,*/
            zoomed_times, zoomed_values,
            refresh, clear, 
            show_zoomed, /*show_diff,*/ 
            /*diff_line_ids*/} = this.state;
        const {robotScene} = this.props;
        const rsmanager = this.props.robotSceneManager;
        let times = this.times;
        let values = this.values;
        // console.log(graph_list);
        // console.log(is_part_changed);
        if(clear){
            times = [];
            values = [];
            this.times = times;
            this.values = values;
            this.setState({
                /*times: [],
                values: [],*/
                zoomed_times: [],
                zoomed_values: [],
                line_names: [],
                line_ids: [],
                clear: false,
                need_update: false,
            });
            return;
        }        
        //new lists to be filled and stored in states
        let newTimes:number[][] = [];
        let newVals:number[][] = [];
        let newZTimes:number[][] = []; //zoomed times
        let newZVals:number[][] = []; //zoomed values
        let newLineNames: string[] = [];
        let newLineIds: string[] = [];
        let newColorMap = new Map<string, string>();

        //handle time warp graphs seperately
        if(this.props.isTimeWarp){

            if(robotScene === undefined)
                return;
            let twMap = robotScene.timeWarping()?.timeWarpMap();
            let startTime = rsmanager.startTime(); // the max between base and target, add vertical/horizontl compoenntes
            let endTime = rsmanager.endTime();
            if(twMap && twMap.length === 2){
                newTimes.push(twMap[0].concat());
                newVals.push(twMap[1].concat());
            }else{
                newTimes.push([startTime,endTime]);
                newVals.push([startTime,endTime]);
            }
            //reference line
            let ref_values = [];
            for(const time of newTimes[0])
            {
                ref_values.push(this.interpolate(startTime, time, endTime, startTime, endTime));
            }
            newTimes.push(newTimes[0]);
            newVals.push(ref_values);
            newLineNames = ["time warp", "reference"];
            newLineIds = ["warp", "ref"];
            newColorMap.set("time warp", "#99f");
            newColorMap.set("reference", "green");
            times = [];
            values = [];
            this.times = newTimes;
            this.values = newVals;
            this.setState({
                /*
                times: newTimes,
                values: newVals,*/
                zoomed_times: newZTimes,
                zoomed_values: newZVals,
                prev_times: {
                    start: rsmanager.currStartTime(),
                    end: rsmanager.currEndTime(),
                    curr: rsmanager.currTime()
                },
                
                line_names: newLineNames,
                line_ids: newLineIds,
                color_map: newColorMap,
                need_update: false,
            });
            this.props.graph.setLineNames(newLineNames);
            this.props.graph.setLineIds(newLineIds);
            let line_colors = [];
            for (const l of newLineNames) {
                line_colors.push(newColorMap.get(l)!);
            }
            this.props.graph.setLineColors(line_colors);
            return;
        }
    }

    componentWillUnmount() {
        if (this._panel_resize_observer) {
          this._panel_resize_observer.disconnect();
        }
    }
    componentDidMount(): void {
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
        this.fillGraphData();
    }
    componentDidUpdate(prevProps:graph_panel_props) {
        const {prev_times, refresh, clear, need_update} = this.state;
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
            refresh ||
            clear ||
            need_update) {
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
        this.props.robotSceneManager.setCurrGraph(this.props.graph.id());
    };

    // check if time has changed in render manually
    render() {
      const times = this.times;
      const values = this.values;
      const {robotScene} = this.props;
      const {zoomed_times, color_map,
        prev_times,
        panelHeight,
        panelWidth,
        line_names, line_ids
      } = this.state;
      let line_colors: string[] = [];
      for (const l of line_names) {
        line_colors.push(color_map.get(l)!);
        //translate line_names to readable names
      }
      let selected:boolean = (this.props.robotSceneManager.getCurrGraph() === this.props.graph);
      let title = (robotScene === undefined) ? "Time Warp" : robotScene.name();
      return (
        <div className={"GraphPanel"} ref={this._graphDiv} onClick={this.clickHandler.bind(this)}
        style={{backgroundColor: this.props.graph.backgroundColor(), overflow: "auto"}}>
              <div className="LegendMessage">
                  <DragButton
                      buttonValue={"Legend"}
                      title={"Click and drag to open the legend"}
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
                  <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.TimeWarpedGraphPanel)}>
                      <FontAwesomeIcon className="Icon" icon={faQuestion} />
                  </button>
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
              isTimeWarp={true}
              line_names={line_names}
              line_colors={line_colors}
              title={title}
              width={panelWidth}
              height={panelHeight}
              line_ids={line_ids}
              prev_map={new Map()}
              selected={selected}
              lineWidth={this.props.graph.lineWidth()}
              axisColor={this.props.graph.axisColor()}
              onGraphUpdate={this.onGraphUpdate.bind(this)}
              onCurrChange={this.onCurrTimeChange.bind(this)}
              onStartChange={this.onStartTimeChange.bind(this)}
              onEndChange={this.onEndTimeChange.bind(this)}
            />
          }
        </div>
      );
    }
}