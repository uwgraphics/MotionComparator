import React from "react";
import DockLayout, { DockMode, DropDirection, LayoutBase, TabBase, TabData, PanelBase, BoxBase } from "rc-dock";
import { Component, MouseEvent } from "react";
import { RobotSceneManager } from "../RobotSceneManager";
import { AnimationPanel } from "./panels/AnimationPanel";
import { LoadAndSavePanel } from "./panels/LoadAndSavePanel";
import { RobotCanvas } from "./RobotCanvas";
import { RobotScene } from "../scene/RobotScene";
import { Robot } from "../objects3D/Robot";
import { GraphPanel } from "./panels/GraphPanel";
import { DifferenceGraphPanel } from "./panels/DifferenceGraphPanel";
import { RobotJoint } from "../objects3D/RobotJoint";
import { RobotLink } from "../objects3D/RobotLink";
import { newID } from "../helpers";
import { SelectionPanel } from "./panels/SelectionPanel";
import { GraphOptionPanel } from "./panels/GraphOptionPanel";
import { SceneOptionsPanel } from "./panels/SceneOptionPanel";
import { RobotOptionsPanel } from "./panels/RobotOptionPanel";
import { TimeWarpGraphPanel } from "./panels/TimeWarpGraphPanel";
import { Graph } from "../objects3D/Graph";
import { GraphLegendPanel } from "./panels/GraphLegendPanel";
import { SceneLegendPanel } from "./panels/SceneLegendPanel";
import { QuaternionSpaceOptionPanel } from "./panels/QuaternionSpaceOptionPanel";
import { QuaternionSpaceCanvas } from "./QuaternionSpaceCanvas";
import { QuaternionSpaceScene } from "../scene/QuaternionSpaceScene";
import { QuaternionSpaceLegendPanel } from "./panels/QuaternionSpaceLegendPanel";
import { UmapGraphOptionPanel } from "./panels/UmapGraphOptionPanel";
import { UmapGraph } from "../objects3D/UmapGraph";
import { UmapGraphPanel } from "./panels/UmapGraphPanel";
import { UmapLegendPanel } from "./panels/UmapLegendPanel";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../constants";
import { PopupHelpPage } from "./popup_help_page";

export interface robot_workspace_props {
    robotSceneManager: RobotSceneManager,
}


interface robot_workspace_state {
    layoutBase: LayoutBase,
    eventName:string[],
    add:boolean,
    clear: boolean,
    refresh: boolean,
    line_names: string[], //list of names of lines graphed, used by Graph Panel and Option Panel, can be removed since Option Panel is removed
    line_ids: string[], //list of names of lines graphed
    legend: boolean,
    need_update: boolean,
    filter: number,
    show_diff: boolean, 
    diff_line_ids: string[], // two difference lines ids
    times: number[][],
    values: number[][],
    is_part_changed: Map<string, number>, //id name to old index in times/values, if -1, then it's new line and need line generation(data and graph)
    //currSelectedGraph: Graph, // id of the currently selected graph tab
    clear_options: boolean, // whether to clear the options in GraphPropertyPanel or not
    // currRobot: Robot | undefined,
    // currScene: RobotScene | undefined,
    event_x: number,
    time_warp_time_bars: string[],
    force_update: boolean, // helper variable to trigger updates in Graph and Difference Graph
    //graph_map: Map<string, Graph>;
    graph_update: boolean, 
    // savedLayout: LayoutBase | undefined,
}
type vectorKeys = 'x' | 'y' | 'z';
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

export type ReactContextT = {
    robotSceneManager:RobotSceneManager,
    robotScene: RobotScene,
    getParentDockLayout: () => DockLayout | undefined,
    selectedRobot?: Robot,
}

// Tab IDs
const ANIMATE_TAB = "Time Bar";
const ANIMATE_TIMEWARP_TAB = "Animate Timewarp";
// const SELECT_SCENE_TAB = "Select Scene";
const SELECT_OBJECT_TAB = "Select Object";
const TRACE_OBJECT_TAB = "Trace Object";
// const LOAD_N_SAVE_TAB = "Load&Save";
const LOAD_N_SAVE_TAB = "File";
const HOME_TAB = "Home";
const OBJECT_EDITOR_TAB = "Edit Object";
const EDIT_ANIMATIONS_TAB = "Edit Animations";
const GRAPH_OBJECT_TAB = "Graph Object";
const GHOST_TAB = "Ghosts";
const CAMERAS_TAB = "Cameras";
const TIME_WARP_TAB = "Time Warp";
const GRAPH_SELECTION_TAB = "Graph Selection";
const GRAPH_OPTION_TAB = "Graph Option";
const SELECTION_TAB = "Selection";
const GRAPH_OPTIONS_TAB = "Graph Options";
const SCENE_OPTIONS_TAB = "Scene Options";
const ROBOT_OPTIONS_TAB = "Robot Options";
const DEFAULT_GRAPH_KEY = newID(4);
const DEFAULT_GRAPH_TAB = `Graph&${DEFAULT_GRAPH_KEY}&motion`;
const QUATERNION_OPTIONS_TAB = "Quaternion Options";
const UMAP_GRAPH_OPTIONS_TAB = "UMAP Options"

// @ts-ignore
export const WorkspaceContext:React.Context<ReactContextT> = React.createContext();

export class RobotWorkspace extends Component<robot_workspace_props, robot_workspace_state> {
    protected _layoutRef: React.RefObject<DockLayout>;

    constructor(props: robot_workspace_props) {
        super(props);

        this._layoutRef = React.createRef();

        this.state = {
            layoutBase: this.getDefaultLayout(),
            eventName: [],
            add: true,
            clear: false,
            refresh: false,
            line_names: [],
            times: [],
            values: [],
            line_ids: [],
            legend: true,
            need_update: true,
            filter: 0,
            show_diff: false,
            diff_line_ids: [],
            is_part_changed: new Map<string, number>(),
            //currSelectedGraph: graph,
            clear_options: false,
            // currRobot: undefined,
            // currScene: undefined,
            event_x: 0,
            time_warp_time_bars: [],
            force_update: false,
            //graph_map: new Map<string, Graph> (),
            graph_update: false,
            // savedLayout: undefined,
        }
        let graph = new Graph(DEFAULT_GRAPH_KEY, false, false);
        this.props.robotSceneManager.addGraph(graph);
        this.props.robotSceneManager.setCurrGraph(DEFAULT_GRAPH_KEY);
        //this.state.graph_map.set(DEFAULT_GRAPH_KEY, graph);
        this.drag = this.drag.bind(this);
        this.onRestoreLayout = this.onRestoreLayout.bind(this);
    }

    addNewTimeWarpTimeBar(targetSceneId: string) {
        const newTabId = "TimeWarpTimeBar" + targetSceneId;
        const updatedLayoutBase = { ...this.state.layoutBase };
        const panel = updatedLayoutBase.dockbox.children[1] as PanelBase;
        panel.tabs?.push({ id: newTabId });
        this.setState({
            layoutBase: updatedLayoutBase,
        });
    }

    onSaveLayout(): LayoutBase | undefined
    {
        let layout = this.getLayout();
        let savedLayout = layout?.saveLayout();
        return savedLayout;
    }
    onRestoreLayout(savedLayout: LayoutBase | undefined)
    {
        console.log("restore layout");
        let layout = this.getLayout();
        if(layout !== undefined && savedLayout !== undefined)
        {
            console.log(savedLayout);
            this._layoutRef.current?.loadLayout(savedLayout);
            this.setState({
                layoutBase: savedLayout
            });
        }
    }
    /**
     * set the scene option panel tab to be active in its parent group
     * so that the user does not need to manually click scene option panel.
     * Whenever the user selects a scene, the scene option panel will automatically
     * be set to active and displayed.
     */
    setSceneOptionPanelActive()
    {
        this.getLayout()?.updateTab(SCENE_OPTIONS_TAB,  null, true);
    }
    setRobotOptionPanelActive()
    {
        this.getLayout()?.updateTab(ROBOT_OPTIONS_TAB,  null, true);
    }
    setGraphOptionPanelActive()
    {
        this.getLayout()?.updateTab(GRAPH_OPTIONS_TAB,  null, true);
    }
    setQuaternionSceneOptionPanelActive()
    {
        this.getLayout()?.updateTab(QUATERNION_OPTIONS_TAB,  null, true);
    }
    setUmapGraphOptionPanelActive()
    {
        this.getLayout()?.updateTab(UMAP_GRAPH_OPTIONS_TAB,  null, true);
    }

    /**
     * it is a hack function for the SceneOptionPanel to call
     * whenever the user changes the name of the tab.
     * Setting State will force the DockLayout to update 
     * (i.e. reload all the tabs and their names)
     */
    forceUpdateTabNames(){
        const updatedLayoutBase = { ...this.state.layoutBase };
        this.setState({
            layoutBase: updatedLayoutBase,
            force_update: !this.state.force_update,
        });
    }

    /**
     * helper function to update the graph panel instantaneously
     * when this function is called in GraphLegend panel, it triggers
     * the graph panel to update the curves shown in the graph at once
     */
    updateLegendState(graph_update?: boolean)
    {
        this.setState({
            graph_update: (graph_update === undefined) ? this.state.graph_update : graph_update,
        });
    }
    /**
     * helper function in parent class
     * when SelectionPanel calls this function, the corresponding states will be updated
     * which triggers the componentDidUpdate function in GraphPanel
     * the callers can pass undefined if they do not want to change that state variable
     * @param eventName 
     * @param add
     */
    // updateSelectionPanelState(currScene?: RobotScene, currRobot?:Robot)
    // {
    //     this.setState({
    //         currScene: (currScene === undefined) ? this.state.currScene : currScene,
    //         currRobot: (currRobot === undefined) ? this.state.currRobot : currRobot,
    //     });
    // }
    
    /**
     * helper function in parent class
     * when GraphPropertyPanel calls this function, the corresponding states will be updated
     * which triggers the componentDidUpdate function in GraphPanel
     * the callers can pass undefined if they do not want to change that state variable
     * @param eventName 
     * @param add
     */
    updateGraphPropertyPanelState(eventName?:string[], add?:boolean, filter?:number, currSelectedGraph?:Graph, legend?:boolean, clear_options?: boolean)
    {
        //console.log("on change graph property called in parent class ");
        if(currSelectedGraph !== undefined)
        {
            // if(!this.state.graph_map.has(currSelectedGraph.id()))
            //     this.state.graph_map.set(currSelectedGraph.id(), currSelectedGraph);
        }
        this.setState({
            eventName: (eventName === undefined) ? this.state.eventName : eventName,
            add: (add === undefined) ? this.state.add : add,
            filter: (filter === undefined) ? this.state.filter : filter,
            // currSelectedGraph: (currSelectedGraph === undefined) ? this.state.currSelectedGraph : currSelectedGraph,
            legend: (legend === undefined) ? this.state.legend : legend,
            clear_options: (clear_options === undefined) ? this.state.clear_options : clear_options,
        });
    }


    hasTabById = (id: string): boolean => {
        let layout = this._layoutRef.current;
        if (layout) {
            return layout.find(id) !== undefined;
        }
        return false;
    }

    removeTabById = (id: string) => {
        let layout = this._layoutRef.current;
        if (layout) {

            let toMove = layout.find(id);
            if (toMove !== undefined) {
                // @ts-ignore
                layout.dockMove(toMove, null, "remove")
            }
        }
    }

    /**
     * The format for RobotScene view id is
     * `RobotScene&id&RobotScene.id().value()`. This method parses that out
     * and returns its parts in the form [robotSceneStr, num, idValue]. If `num`
     * is undefined, that means that this robotSceneId needs to be given a
     * number.
     * @param id The input ID.
     * @returns The output parts of the id.
     */
    robotSceneIdParts = (id: string): [string, string, string] => {
        let i = id.indexOf('&');
        let robotSceneStr = id.slice(0, i);
        let rest = id.slice(i + 1, id.length);

        let idValue: string;
        let key: string | undefined = undefined;

        i = rest.indexOf('&');

        if (i !== -1) {
            // There is a number and then the ID
            key = rest.slice(0, i);
            idValue = rest.slice(i + 1, rest.length);
        } else {
            idValue = rest;
        }

        if (key === undefined) {
            throw new Error("RobotScene with undefined ID in DockLayout");
        }

        return [robotSceneStr, key, idValue];
    }

    /**
     * Returns the layout that the RobotWorkspace starts out in by default.
     * @returns The default layout i.e. the layout that the application starts out in.
     */
    getDefaultLayout = (): LayoutBase => {
        let horizontal:DockMode = 'horizontal';
        let vertical:DockMode = 'vertical';

        return {
            dockbox: {
                mode: vertical,
                children: [
                    {
                        mode: horizontal,
                        children: [
                            {
                                tabs: [
                                    { id: SELECTION_TAB, },
                                    // { id: SELECT_SCENE_TAB, },
                                    // { id: SELECT_OBJECT_TAB, },
                                ]
                            },
                            {
                                size: 700,
                               
                                tabs: [
                                    { id: HOME_TAB, }
                                ]
                            },
                            {
                                size: 300,
                                mode: vertical,
                                children: [
                                    {
                                        tabs: [
                                            { id: LOAD_N_SAVE_TAB, },
                                            // { id: OBJECT_EDITOR_TAB, },
                                            // { id: TRACE_OBJECT_TAB, },
                                            { id: SCENE_OPTIONS_TAB, },
                                            { id: ROBOT_OPTIONS_TAB, },
                                            // { id: GRAPH_OBJECT_TAB, },
                                            { id: GRAPH_OPTIONS_TAB, },
                                            { id: QUATERNION_OPTIONS_TAB, },
                                            { id: UMAP_GRAPH_OPTIONS_TAB, },
                                            // { id: GRAPH_SELECTION_TAB, },
                                            // { id: GRAPH_OPTION_TAB, },
                                            // { id: EDIT_ANIMATIONS_TAB, },
                                            // { id: TIME_WARP_TAB, },
                                            // { id: GHOST_TAB, },
                                        ]
                                    },
                                    {
                                        size: 250,
                                        tabs: [
                                            { id: DEFAULT_GRAPH_TAB, },
                                        ]
                                    },
                                ]
                            }
                        ]
                    },
                    {
                        size: 30,
                        tabs: [
                            { id: ANIMATE_TAB, },
                            // { id: ANIMATE_TIMEWARP_TAB, },
                            // { id: CAMERAS_TAB, }
                        ]
                    }
                ]
            },
        };
    }

    getLayout = (): undefined | DockLayout => {
        let curr = this._layoutRef.current;
        return curr ? curr : undefined;
    }

    missingTab = (tabId: string, missingMsg:string = "Missing Tab"): JSX.Element => {
        setTimeout(this.removeTabById, 0, tabId); // Will remove the tab after the dom has updated (because that's the next time an event like this one can be run)
        return (<div key={tabId}>{missingMsg}</div>);
    }

    tabWrap = (tabMeth:(id: string | undefined) => TabData | undefined): ((data:TabBase) => TabData) => {
        return (data: TabBase): TabData => {
            let {id} = data;
            let res = tabMeth(id);
            if (res !== undefined) {
                return res;
            } else {
                setTimeout(this.removeTabById, 0, id); // Will remove the tab after the dom has updated (because that's the next time an event like this one can be run)
                return {
                    id: id,
                    closable: true,
                    cached: true,
                    title: "Missing Tab",
                    content: (<div key={`Undefined Tab!`}>Missing Tab Data</div>),
                };
            }           
        }
    }

    onClickImage(url: string){
        this.props.robotSceneManager.loadSessionFromURL(url, this.onRestoreLayout)
    }
    createHomeTab(){

        return (
            <div className={"HomeTab"}>
                <div>
                    <h1>👋 Welcome to Motion Comparator</h1>

                    <br></br>
                    <br></br>
                    <h3> Motion Comparator helps roboticists  
                    visualize 👀, understand 💡, compare 🔍, and communiate 💬 
                     robot motions. </h3> 
                    <br></br>
                    <br></br>

                    <div className="PopUpGroup" style={{justifyContent: "center", alignItems: "center"}}>
                        <p> Explore the examples below or click on the help icon </p>
                        <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.Home)}>
                            <FontAwesomeIcon className="Icon" icon={faQuestion} />
                        </button> 
                        <p>to get started.</p>
                    </div>
                    <br></br>
                    <br></br>

                    <div >
                        <div className={"ExampleImageGroup"}>
                            <img src="https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/panda_pick_and_place/panda_pick_and_place.png" className={"ExampleImage"} alt="Panda Pick and Place"/>
                            <div className={"ExampleImageOverlay"} onClick={() => this.onClickImage("https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/panda_pick_and_place/panda_pick_and_place.json")}>
                                <div className={"ExampleImageOverlayText"}>Pick and Place Motions of Panda Robot </div>
                            </div>
                        </div>

                        <div className={"ExampleImageGroup"}>
                            <img src="https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/mico_legible/mico_legible.png" className={"ExampleImage"} alt="Mico Legible" />
                            <div className={"ExampleImageOverlay"} onClick={() => this.onClickImage("https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/mico_legible/mico_legible.json")}>
                                <div className={"ExampleImageOverlayText"}>Legible Motions of Mico Robot </div>
                            </div>
                        </div>

                        <div className={"ExampleImageGroup"}>
                            <img src="https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/spot_arm_sweep/spot_arm_sweep.png" className={"ExampleImage"} alt="Pick and Place" />
                            <div className={"ExampleImageOverlay"} onClick={() => this.onClickImage("https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/spot_arm_sweep/spot_arm_sweep.json")}>
                                <div className={"ExampleImageOverlayText"}>Sweeping Motions of Spot Robot </div>
                            </div>
                        </div>

                        <div className={"ExampleImageGroup"}>
                            <img src="https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/sawyer_teleop/sawyer_teleop.png" className={"ExampleImage"} alt="Pick and Place" />
                            <div className={"ExampleImageOverlay"} onClick={() => this.onClickImage("https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/sawyer_teleop/sawyer_teleop.json")}>
                                <div className={"ExampleImageOverlayText"}>Teleoperation of Sawyer Robot </div>
                            </div>
                        </div>

                        <div className={"ExampleImageGroup"}>
                            <img src="https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/ur5_rangedik/ur5_rangedik.png" className={"ExampleImage"} alt="Trajectory Tracking" />
                            <div className={"ExampleImageOverlay"} onClick={() => this.onClickImage("https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/workspaces/ur5_rangedik/ur5_rangedik.json")}>
                                <div className={"ExampleImageOverlayText"}>Trajectory Tracking of UR5 Robot </div>
                            </div>
                        </div>

                        <br></br>
                        <br></br>

                        <a href="https://github.com/motion-comparator/MotionComparator" target="_blank" rel="noopener noreferrer">
                            <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Github-Light.svg" className={"GithubIcon"} alt="Github" />
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // -----------
    // DockLayout Methods

    loadTab = (id?: string | undefined): TabData | undefined => {

        if (id === undefined) {
            console.error("Undefined ID");
            return {
                closable: true,
                title: "Undefined Tab",
                content: <div key={`Undefined Tab!`}></div>,
            };
        }

        if (id === ANIMATE_TAB) {
            return {
                id: ANIMATE_TAB,
                title: ANIMATE_TAB,
                cached: true,
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <AnimationPanel
                                robotSceneManager={ctx.robotSceneManager}
                                robotScene={ctx.robotScene}
                                event_x={this.state.event_x}
                                global={true}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                )
            };
        } 
        else if (id.startsWith('TimeWarpTimeBar')) {
            const targetSceneId = id.substring("TimeWarpTimeBar".length);
            let scene = this.props.robotSceneManager.robotSceneById(targetSceneId);
            let sceneName = scene?.name();
            return {
                id: id,
                title: (sceneName === undefined) ? ANIMATE_TIMEWARP_TAB : sceneName + " Time Bar",
                cached: true,
                closable: true,
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <AnimationPanel
                                robotSceneManager={ctx.robotSceneManager}
                                robotScene={ctx.robotScene}
                                event_x={this.state.event_x}
                                currTimeBar_prop={"double"}
                                global={false}
                                targetSceneId={targetSceneId}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                )
            };
        }
        else if (id === LOAD_N_SAVE_TAB) {
            return {
                id: LOAD_N_SAVE_TAB,
                title: LOAD_N_SAVE_TAB,
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <LoadAndSavePanel
                                robotSceneManager={ctx.robotSceneManager}
                                animationManager={ctx.robotScene.animationManager()}
                                // getParentDockLayout={ctx.getParentDockLayout}
                                onSaveLayout={this.onSaveLayout.bind(this)}
                                onRestoreLayout={this.onRestoreLayout.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                )
            };
        } else if (id === HOME_TAB) {
            return {
                id: HOME_TAB,
                title: HOME_TAB,
                content: (this.createHomeTab())
            };
        } 
        else if (id === GRAPH_OPTIONS_TAB)
        {
            let sceneManager = this.props.robotSceneManager;
            return {
                id: GRAPH_OPTIONS_TAB,
                title: GRAPH_OPTIONS_TAB,
                
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <GraphOptionPanel
                                    robotSceneManager={sceneManager}
                                    updateGraphPropertyPanelState={this.updateGraphPropertyPanelState.bind(this)}
                                    filter_prop={this.state.filter}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    // currSelectedGraph={this.state.currSelectedGraph}
                                    forceUpdateTabNames={this.forceUpdateTabNames.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        } 
        else if (id === SCENE_OPTIONS_TAB)
        {
            let sceneManager = this.props.robotSceneManager;
            return {
                id: SCENE_OPTIONS_TAB,
                title: SCENE_OPTIONS_TAB,
                
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <SceneOptionsPanel
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    // currSelectedGraph={this.state.currSelectedGraph}
                                    robotSceneManager={ctx.robotSceneManager}
                                    robotScene={ctx.robotScene}
                                    animationManager={ctx.robotScene.animationManager()}
                                    addNewTimeWarpTimeBar={this.addNewTimeWarpTimeBar.bind(this)}
                                    forceUpdateTabNames={this.forceUpdateTabNames.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        } 
        else if (id === ROBOT_OPTIONS_TAB)
        {
            let sceneManager = this.props.robotSceneManager;
            return {
                id: ROBOT_OPTIONS_TAB,
                title: ROBOT_OPTIONS_TAB,
                
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <RobotOptionsPanel
                                    robotSceneManager={sceneManager}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    // currRobot={this.state.currRobot}
                                    // currScene={this.state.currScene}
                                    animationManager={ctx.robotScene.animationManager()}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        } 
        else if(id === QUATERNION_OPTIONS_TAB)
        {
            let sceneManager = this.props.robotSceneManager;
            return {
                id: QUATERNION_OPTIONS_TAB,
                title: QUATERNION_OPTIONS_TAB,
                
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <QuaternionSpaceOptionPanel
                                    robotSceneManager={sceneManager}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    forceUpdateTabNames={this.forceUpdateTabNames.bind(this)}
                                    currQuaternionSpaceScene={sceneManager.getCurrQuaternionSpaceScene()}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }

        else if(id === UMAP_GRAPH_OPTIONS_TAB)
        {
            let sceneManager = this.props.robotSceneManager;
            return {
                id: UMAP_GRAPH_OPTIONS_TAB,
                title: UMAP_GRAPH_OPTIONS_TAB,
                
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return <UmapGraphOptionPanel
                                robotSceneManager={sceneManager}
                                getParentDockLayout={ctx.getParentDockLayout}
                                currSelectedGraph={sceneManager.getCurrUmapGraph()}
                                forceUpdateTabNames={this.forceUpdateTabNames.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if (id === SELECTION_TAB) {
            return {
                id: SELECTION_TAB,
                title: SELECTION_TAB,
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            return (
                                <SelectionPanel
                                    robotSceneManager={ctx.robotSceneManager}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    // updateSelectionPanelState={this.updateSelectionPanelState.bind(this)}
                                    setSceneOptionPanelActive={this.setSceneOptionPanelActive.bind(this)}
                                    setRobotOptionPanelActive={this.setRobotOptionPanelActive.bind(this)}
                                />
                            );
                        }}
                    </WorkspaceContext.Consumer>
                )
            };

        }
        else if(id === DEFAULT_GRAPH_TAB)
        {
            let [, key, type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            
            let graph = sceneManager.getGraphById(key);
            if (graph === undefined) {
                graph = new Graph(key, false, false);
                sceneManager.addGraph(graph);
                sceneManager.setCurrGraph(graph.id());
            }
            return {
                id: id,
                closable: true,
                cached: true,
                title: graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            if(graph === undefined) return;
                            return <GraphPanel
                                    robotSceneManager={sceneManager}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    key={key}
                                    eventName={this.state.eventName}
                                    add={this.state.add}
                                    filter_prop={this.state.filter}
                                    is_part_changed={this.state.is_part_changed}
                                    force_update={this.state.force_update}
                                    graph={graph}
                                    graph_update={this.state.graph_update}
                                    setGraphOptionPanelActive={this.setGraphOptionPanelActive.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if (id.startsWith('Graph')) {
            // key = the key used to make sure that this id is unique (so you can have multiple graphs of the same thing)
            // sceneId = the id of the scene to graph
            // robotId = the id of the robot to graph
            // robotPart = the part of the robot to graph (if empty, partPart is
            // boolean for whether you're graphing the relative or absolute
            // position of the robot. If not empty, then it is the name of the
            // joint of the robot being graphed)
            // partPart = "true" or "false", if "true", then it is whether you
            // are graphing the angle of the current joint or the current
            // joint's position (if robotPart is "", then this is whether you
            // are graphing the robot's relative or absolute position)
            // console.log(id);
            let [, key,/* sceneId,*/ type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            // let robotScene = sceneManager.robotSceneById(sceneId);

            // if (robotScene === undefined) {
            //     return undefined;
            // }

            // let robot = robotScene.robotById(robotId);
            // if (robot === undefined) {
            //     return undefined;
            // }

            // let _robotPart: undefined | RobotJoint | boolean;
            // let _useAngles: undefined | true | false;
            // if (robotPart === "") {
            //     // It is a position
            //     if (partPart === "true") {
            //         _robotPart = true;
            //     } else if (partPart === "false") {
            //         _robotPart = false;
            //     } else {
            //         APP.error(`Part was not "true" or "false", it was ${_robotPart}`);
            //         return undefined;
            //     }
            // } else {
            //     // It is a joint
            //     _robotPart = robot.jointMap().get(robotPart)
            //     if (_robotPart === undefined) {
            //         // Joint not found
            //         return undefined;
            //     }

            //     if (partPart === "true") {
            //         _useAngles = true;
            //     } else if (partPart === "false") {
            //         _useAngles = false;
            //     } else {
            //         APP.error(`Part was not "true" or "false", it was ${_robotPart}`);
            //         return undefined;
            //     }
            // }

            let graph = sceneManager.getGraphById(key);
            if (graph === undefined) {
                graph = new Graph(key, false, false);
                sceneManager.addGraph(graph);
                sceneManager.setCurrGraph(graph.id());
            }

            return {
                id: id,
                closable: true,
                cached: true,
                title: graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            // let _robotScene = robotScene as RobotScene;
                            // let _robot = robot as Robot;
                            // if (!sceneManager.hasManagedRobotScene(_robotScene)) {
                            //     return this.missingTab(id, "Missing Graph");
                            // }

                            // if (!(_robotScene.hasRobot(_robot))) {
                            //     return this.missingTab(id, "Missing Graph");
                            // }

                            // if (typeof _robotPart !== "boolean") {
                            //     // robotPart is a RobotJoint
                            //     if (!_robot.jointMap().has((_robotPart as RobotJoint).name())) {
                            //         return this.missingTab(id, "Missing Graph");
                            //     }
                            // }
                            if(graph === undefined) return;
                            return <GraphPanel
                                    robotSceneManager={sceneManager}
                                    //robotScene={_robotScene}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    // robot={_robot}
                                    // robotPart={_robotPart as (RobotJoint | boolean)}
                                    // angle={_useAngles ?? false}
                                    key={key}
                                    eventName={this.state.eventName}
                                    add={this.state.add}
                                    filter_prop={this.state.filter}
                                    is_part_changed={this.state.is_part_changed}
                                    force_update={this.state.force_update}
                                    graph={graph}
                                    graph_update={this.state.graph_update}
                                    setGraphOptionPanelActive={this.setGraphOptionPanelActive.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };

        } 
        else if (id.startsWith('DifferenceGraph')) {
            let [, key, type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            // let robotScene = sceneManager.robotSceneById(sceneId);

            // if (robotScene === undefined) {
            //     return undefined;
            // }
            let graph = sceneManager.getGraphById(key);
            if (graph === undefined) {
                graph = new Graph(key, true, false);
                sceneManager.addGraph(graph);
                sceneManager.setCurrGraph(graph.id());
            }
            
            return {
                id: id,
                closable: true,
                cached: true,
                title: graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            // let _robotScene = robotScene as RobotScene;
                            // // let _robot = robot as Robot;
                            // if (!sceneManager.hasManagedRobotScene(_robotScene)) {
                            //     return this.missingTab(id, "Missing Graph");
                            // }
                            if(graph === undefined) return;
                            return <DifferenceGraphPanel
                                    robotSceneManager={sceneManager}
                                    // robotScene={_robotScene}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    key={key}
                                    is_part_changed={this.state.is_part_changed}
                                    eventName={this.state.eventName}
                                    add={this.state.add}
                                    filter_prop={this.state.filter}
                                    force_update={this.state.force_update}
                                    graph={graph}
                                    setGraphOptionPanelActive={this.setGraphOptionPanelActive.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };

        } 
        else if (id.startsWith('TimeWarpedGraph')) {
            let [, key,sceneId, type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            let robotScene = sceneManager.robotSceneById(sceneId);

            if (robotScene === undefined) {
                return undefined;
            }

            let graph = sceneManager.getGraphById(key);
            if (graph === undefined) {
                graph = new Graph(key, false, true);
                sceneManager.addGraph(graph);
            }
            return {
                id: id,
                closable: true,
                cached: true,
                title: graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            // let _robotScene = robotScene as RobotScene;
                            // let _robot = robot as Robot;
                            // if (!sceneManager.hasManagedRobotScene(_robotScene)) {
                            //     return this.missingTab(id, "Missing Graph");
                            // }
                            if(graph === undefined) return;
                            return <TimeWarpGraphPanel
                                    robotSceneManager={sceneManager}
                                    robotScene={robotScene}
                                    isTimeWarp={true}
                                    key={key}
                                    force_update={this.state.force_update}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    graph={graph}
                                    setGraphOptionPanelActive={this.setGraphOptionPanelActive.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };

        } 
        else if (id.startsWith('UmapGraph')) {
            let [, key,type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            
            let graph = sceneManager.getUmapGraphById(key);
            if(graph === undefined)
            {
                graph = new UmapGraph(key);
                sceneManager.addUmapGraph(graph);
                sceneManager.setCurrUmapGraph(key);
            }

            return {
                id: id,
                closable: true,
                cached: true,
                title: graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            if(graph === undefined) return;
                            return <UmapGraphPanel
                                    robotSceneManager={sceneManager}
                                    isTimeWarp={type==="warp"}
                                    getParentDockLayout={ctx.getParentDockLayout}
                                    key={key}
                                    force_update={this.state.force_update}
                                    graph={graph}
                                    setUmapGraphOptionPanelActive={this.setUmapGraphOptionPanelActive.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };

        } 
        else if(id.startsWith('LineGraphLegend'))
        {
            let [, key, graph_id] = id.split("&");
            let graph = this.props.robotSceneManager.getGraphById(graph_id);
            if (graph === undefined) {
                return;
            }
            return {
                id: id,
                closable: true,
                cached: true,
                title: "Legend of " + graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            if (graph === undefined) {
                                return;
                            }
                            return <GraphLegendPanel
                                    graph={graph}
                                    updateLegendState={this.updateLegendState.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if(id.startsWith('SceneLegend'))
        {
            let [, key, sceneId] = id.split("&");
            let sceneManager = this.props.robotSceneManager;
            let robotScene = sceneManager.robotSceneById(sceneId);

           
            return {
                id: id,
                closable: true,
                cached: true,
                title: "Legend of " + robotScene?.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx: ReactContextT) => {
                            if (robotScene === undefined) {
                                return undefined;
                            }
                            return <SceneLegendPanel
                                    robotSceneManager={sceneManager}
                                    robotScene={robotScene}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if(id.startsWith('QuaternionSpaceLegend'))
        {
            let [, key, sceneId] = id.split("&");
            let sceneManager = this.props.robotSceneManager;

            let quaternionSpaceScene: QuaternionSpaceScene | undefined = sceneManager.getQuaternionSpaceSceneById(sceneId);
            if(quaternionSpaceScene === undefined)
            {
                return;
            }
            return {
                id: id,
                closable: true,
                cached: true,
                title: "Legend of " + quaternionSpaceScene?.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx: ReactContextT) => {
                            if (quaternionSpaceScene === undefined) {
                                return undefined;
                            }
                            return <QuaternionSpaceLegendPanel
                                    robotSceneManager={sceneManager}
                                    quaternionSpaceScene={quaternionSpaceScene}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if(id.startsWith('UmapLegend'))
        {
            let [, key, graph_id] = id.split("&");
            let graph = this.props.robotSceneManager.getUmapGraphById(graph_id);
            if (graph === undefined) {
                return;
            }
            return {
                id: id,
                closable: true,
                cached: true,
                title: "Legend of " + graph.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {(ctx:ReactContextT) => {
                            if (graph === undefined) {
                                return;
                            }
                            return <UmapLegendPanel
                                    graph={graph}
                                    updateLegendState={this.updateLegendState.bind(this)}
                            />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else if (id.startsWith('RobotScene')) {
            let [, key, idValue] = this.robotSceneIdParts(id);
            let sceneManager = this.props.robotSceneManager;
            let robotScene = sceneManager.robotSceneById(idValue);

            if (robotScene === undefined) {
                return undefined;
            } else {
                let _robotScene = robotScene;
                let _id = id;
                return {
                    id: id,
                    closable: true,
                    cached: true,
                    title: robotScene.name(),
                    content: (
                        <WorkspaceContext.Consumer>
                            {() => {
                                // Double check that the robotScene is still active
                                // (i.e. it should still be shown)
                                let robotSceneIsActive = sceneManager.hasManagedRobotScene(_robotScene);
                                if (robotSceneIsActive) {
                                    return <RobotCanvas 
                                            allowSelecting={true} 
                                            key={key} 
                                            robotScene={_robotScene} 
                                            robotSceneManager={sceneManager} 
                                            setSceneOptionPanelActive={this.setSceneOptionPanelActive.bind(this)}
                                            setRobotOptionPanelActive={this.setRobotOptionPanelActive.bind(this)}/>;
                                } else {
                                    return this.missingTab(_id, "Missing Scene");
                                }
                            }}
                        </WorkspaceContext.Consumer>
                    ),
                };
            }

        }
        else if (id.startsWith('QuaternionSpaceScene')) {
            let [, sceneId, type] = id.split("&");
            let sceneManager = this.props.robotSceneManager;

            let quaternionSpaceScene: QuaternionSpaceScene | undefined = sceneManager.getQuaternionSpaceSceneById(sceneId);
            if(quaternionSpaceScene === undefined)
            {
                quaternionSpaceScene = new QuaternionSpaceScene(sceneManager, sceneId);
                sceneManager.setCurrQuaternionSpaceScene(sceneId);
            }

            return {
                id: id,
                closable: true,
                cached: true,
                title: quaternionSpaceScene.name(),
                content: (
                    <WorkspaceContext.Consumer>
                        {() => {
                            if(quaternionSpaceScene === undefined) return;
                            return <QuaternionSpaceCanvas
                                allowSelecting={true}
                                key={sceneId}
                                quaternionSpaceScene={quaternionSpaceScene}
                                robotSceneManager={sceneManager} 
                                setQuaternionSceneOptionPanelActive={this.setQuaternionSceneOptionPanelActive.bind(this)}
                                />;
                        }}
                    </WorkspaceContext.Consumer>
                ),
            };
        }
        else {
            console.error(`Unknown tab with id "${id}"`)
            return {
                id: id,
                closable: true,
                title: "Unknown Tab",
                content: this.missingTab(id, "Missing Tab"),
            };
        }
    }

    onLayoutChange = (newLayout: LayoutBase, currentTabId: undefined | string | null, direction: DropDirection) => {

        if (newLayout !== this.state.layoutBase) {
            if (currentTabId !== null && currentTabId !== undefined && currentTabId.startsWith("RobotScene") && direction === "remove") {

                // The drag-and-drop should have have activated the RobotScene when
                // complete, so removeing the RobotScene should deactivate it. Note:
                // the same RobotScene can be activated multiple times in a row and
                // those activations will be counted, so just because we are
                // deactivating it once now does not mean that it will be fully
                // deactivated (may have been activated more than once i.e. multiple
                // views may be looking at the same RobotScene and we are now
                // removing just one of them).

                let [,,idValue] = this.robotSceneIdParts(currentTabId);
                let robotSceneManager = this.props.robotSceneManager;
                let robotScene = robotSceneManager.robotSceneById(idValue);
                if (robotScene) {
                    // Removing robot scene
                    robotSceneManager.deactivateRobotScene(robotScene);
                }
            }

            if (currentTabId !== null && currentTabId !== undefined && (currentTabId.startsWith("Graph") || currentTabId.startsWith("DifferenceGraph") || currentTabId === DEFAULT_GRAPH_TAB)&& direction === "remove") {

                let [, key,/* sceneId,*/ type] = currentTabId.split("&");
                let robotSceneManager = this.props.robotSceneManager;
                let graph = robotSceneManager.getGraphById(key);
                if (graph !== undefined) {
                    robotSceneManager.removeGraph(key);
                    for(const line_id of graph.lineIds())
                    {
                        GraphPanel.removeRobotPartFromGraph(line_id, this.props.robotSceneManager);
                    }
                    
                }
            }

            if (currentTabId !== null && currentTabId !== undefined && currentTabId.startsWith("QuaternionSpaceScene") && direction === "remove") {

                let [, sceneId, type] = currentTabId.split("&");
                let robotSceneManager = this.props.robotSceneManager;
                robotSceneManager.removeQuaternionSpaceScene(sceneId);
            }
            //console.log(newLayout !== this.state.layoutBase, currentTabId, direction);
            this.setState({ layoutBase: newLayout })
        }
    }

    drag(event: MouseEvent) {
        // the className is to find whether the mouse 
        // moves at the Select options (dropdown menus) or not.
        // Adding this variable can resolve the problem that the options cannot be highlighted
        // when the mouse hovers on it after adding this.setState({event_x: event.pageX}).
        // Note: the bug above only happens if this.setState method is called 
        // in this drag (onMouseMove) function
        const className = (event.target as HTMLElement).className;
        if (typeof className === "string" && className.includes("-option")) {
          return;
        }
        this.setState({
          event_x: event.pageX,
        });
    }
    // -----------
    // Base React Methods

    render() {
        let robotSceneManager = this.props.robotSceneManager;
        let mainRobotScene = this.props.robotSceneManager.currRobotScene(false);
        let selectedRobot = mainRobotScene.selectedRobot();

        let dockLayout = this._layoutRef.current;
        if (dockLayout) {
        }

        // // Add event listener for beforeunload to save the layout when the user closes the tab
        // window.addEventListener('beforeunload', handleBeforeUnload);
        // // Handler to save the layout when the beforeunload event is triggered
        // const handleBeforeUnload = (event) => {
        //     // Save the layout to local storage before unloading the page
        //     localStorage.setItem('myAppLayout', JSON.stringify(layoutData));

        //     // Display a custom message to the user (optional)
        //     event.returnValue = 'Are you sure you want to leave? Your changes may not be saved.';
        // };

        return (
            <div className="RobotWorkspace" onMouseMove={this.drag}>
                <WorkspaceContext.Provider
                        value={{
                            robotSceneManager:robotSceneManager,
                            robotScene:mainRobotScene,
                            selectedRobot:selectedRobot,
                            getParentDockLayout: this.getLayout
                        }}
                >
                    <DockLayout
                        ref={this._layoutRef}
                        layout={ this.state.layoutBase }
                        onLayoutChange={this.onLayoutChange}
                        loadTab={this.tabWrap(this.loadTab)}
                    />
                </WorkspaceContext.Provider>
            </div>
        );
    }
}
