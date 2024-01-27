import { sessions_import_format } from "../../import_formats/sessions";
import { Animation } from './Animation';
import { AnimationGroup } from './AnimationGroup';
import { AnimationLoop } from "./AnimationLoop";
import { AnimationTable, joint_motion_data, tf_data } from "./AnimationTable";
import { APP, MAX_FRAMERATE } from './constants';
import { clamp, countUsing, enumerate, newID, onlyUniquesUsing as onlyUniquesBy, zip } from "./helpers";
import { fromXYZ, fromXYZW, toXYZ, toXYZW } from "./helpers_serials";
import { loadCSVFromURL, loadJsonFromLocalFile } from "./load_functions";
import { Robot } from "./objects3D/Robot";
import { FrameData, RobotScene } from "./scene/RobotScene";
import chroma from "chroma-js";
import assert, { AssertionError } from 'assert';
import T from "./true_three";
import { DynamicTimeWarp } from "./DynamicTimeWarping";
import { RobotJoint } from "./objects3D/RobotJoint";
import { RobotLink } from "./objects3D/RobotLink";
import { QuaternionSpaceScene } from "./scene/QuaternionSpaceScene";
import { UmapGraph } from "./objects3D/UmapGraph";
import { BoxBase, LayoutBase, PanelBase, TabBase } from "rc-dock";
import { Graph } from "./objects3D/Graph";
import { Id } from "./Id";
import { PopupHelpPage } from "./react_components/popup_help_page";

export interface serialized_robot_scene_manager {
}


/**
 * Returns true if the two lists of strings are equal and false otherwise. 
 */
function eqStrList(strList1:string[], strList2:string[]):boolean {
    for (const [str1, str2] of zip(strList1, strList2)) {
        if (str1 !== str2) {
            return false;
        }
    }
    return true;
}

const sceneColorRamp = chroma.scale([chroma(255, 0, 255), chroma(255, 0, 0), chroma(255, 255, 0), chroma(0, 255, 0), chroma(0, 255, 255), chroma(0, 0, 255)]).mode('rgb');

export type CameraViewpoint = [T.Vector3, T.Quaternion];
export type CameraViewpointCallback = (cv: CameraViewpoint) => void;

/**
 * A class to encapsulate the managing of what objects/animations are currently
 *   being shown in a RobotScene. The RobotScene is owned by the SceneManager.
 */
export class RobotSceneManager {
    protected _masterRobots: Robot[]; // The Robot objects that are simply copied into child RobotScenes
    protected _activeScenes: RobotScene[]; // The RobotScenes currently in use i.e. should be shown in a tab of the application
    protected _currScene?:   RobotScene; // The current RobotScene

    // A list of every scene the RobotSceneManager currenty manages.
    protected _availableScenes: [string[], RobotScene, Map<string, string>][];
    protected _isSorted: boolean;
    protected _animationTables: AnimationTable[];

    protected _allowSelections: boolean;

    protected _animationLoop: AnimationLoop;

    public _controlledScenes: RobotScene[]; // These are scenes that have some components in them with ghosts. As such, they need to have their animations updated even if they are not actively displayed

    protected _syncViews: boolean; // Whether want to currently synchronize all views so that they have the same viewpoint
    protected _syncViewCallbacks: CameraViewpointCallback[];
    protected _currSyncView: CameraViewpoint; // The current [world position, world direction] viewpoint to sync all cameras to (if enabled)

    protected _currTimeWarpBase: RobotScene | undefined

    protected _quaternionSpaceScenes: Map<String, QuaternionSpaceScene>; // the quaternion space scenes which behave similarly as robot scenes
    protected _currQuaternionSpaceScene?: QuaternionSpaceScene;
    
    protected _umapGraphs: Map<String, UmapGraph>; // Umap graphs are also stored in robotscenemanager because it can be managed similiarly as the robot scenes
    protected _currUmapGraph?: UmapGraph;

    protected _graphs: Map<string, Graph>;
    protected _currSelectedGraph?: Graph;

    protected _restoreCallBack?: (savedLayout: LayoutBase | undefined) => void;

    protected _jointMotions: Map<string, joint_motion_data>; // all available joint motion data
    protected _tfs: Map<string, tf_data>; // all available transformation data

    constructor() {
        this._masterRobots = [];
        this._animationTables = [];
        this._availableScenes = [];
        this._activeScenes = [];
        this._isSorted = false;
        this._allowSelections = true;

        this._quaternionSpaceScenes = new Map();

        this._umapGraphs = new Map();
        this._graphs = new Map();
        
        this._jointMotions = new Map();
        this._tfs = new Map();

        this._controlledScenes = [];

        this._animationLoop = new AnimationLoop(MAX_FRAMERATE, 0, 1, (currTime) => {
            // figure out what scenes need to be rendered
            let scenesToRender: Set<RobotScene> = new Set();
            for (const scene of this._activeScenes) {
                scenesToRender.add(scene); }
            for (const scene of this._controlledScenes) {
                scenesToRender.add(scene); }

            // Render the scenes
            for (const scene of scenesToRender) {
                // timewarping will be 1:1 when no time warp is set and will be
                // some other mapping otherwise, so we can just use the
                // "timeWarp" function directly
                let timeWarpObj = scene.timeWarping();
                if (timeWarpObj !== undefined) {
                    currTime = timeWarpObj.timeWarp(currTime);
                }

//                if (scene.timeWarpMap() !== undefined) {
//                    if (currTime === warpedTime) {
//                        //console.warn(`${scene.name()}: ${currTime} -> ${warpedTime}`);
//                    } else {
//                        //console.log(`${scene.name()}: ${currTime} -> ${warpedTime}`);
//                    }
//                }
                scene.animationManager().setTime(currTime);
            }
            this.updateAllTraceSymbols();
            APP.updateUI();
            APP.render();
        });

        // Figure out syncing cameras stuff
        this._syncViews = false;
        let tempCam = new T.Camera();
        tempCam.position.set(3, 3, 3);
        tempCam.lookAt(0, 0, 0);
        this._currSyncView = [tempCam.position.clone(), new T.Quaternion().setFromEuler(tempCam.rotation)];
        this._syncViewCallbacks = [];
    }

    setRestoreCallBack(restoreCallBack: (savedLayout: LayoutBase | undefined) => void)
    {
        this._restoreCallBack = restoreCallBack;
    }

    addJointMotion(motion: joint_motion_data)
    {
        this._jointMotions.set(motion.id, motion);
    }
    removeJointMotion(id: string)
    {
        this._jointMotions.delete(id);
    }
    getJointMotionById(id: string): joint_motion_data | undefined
    {
        return this._jointMotions.get(id);
    }
    getAllJointMotions(): Map<string, joint_motion_data>
    {
        return this._jointMotions;
    }

    addTF(tf: tf_data)
    {
        this._tfs.set(tf.id, tf);
    }
    removeTF(id: string)
    {
        this._tfs.delete(id);
    }
    getTFById(id: string): tf_data | undefined
    {
        return this._tfs.get(id);
    }
    getAllTFs(): Map<string, tf_data>
    {
        return this._tfs;
    }

    // ---------------------------
    // the functions below are the helper functions for graphs
    hasGraph(graphId: string): boolean
    {
        return this._graphs.has(graphId);
    }
    addGraph(graph: Graph)
    {
        this._graphs.set(graph.id(), graph);
    }
    removeGraph(graphId: string)
    {
        this._graphs.delete(graphId);
    }
    getGraphById(graphId: string): Graph | undefined
    {
        return this._graphs.get(graphId);
    }
    getAllGraphs(): Graph[]
    {
        let graphs: Graph[] = [];
        for(const [, graph] of this._graphs)
            graphs.push(graph);
        return graphs;
    }
    getCurrGraph(): Graph | undefined
    {
        return this._currSelectedGraph;
    }
    setCurrGraph(graphId: string | undefined)
    {
        if(graphId === undefined) 
        {
            this._currSelectedGraph = undefined;
            return;
        }
        if(this.hasGraph(graphId))
            this._currSelectedGraph = this._graphs.get(graphId);
    }

    // ---------------------------
    // the functions below are the helper functions for umap graphs
    hasUmapGraph(uGraphId: string): boolean
    {
        return this._umapGraphs.has(uGraphId);
    }
    addUmapGraph(uGraph: UmapGraph)
    {
        this._umapGraphs.set(uGraph.id(), uGraph);
    }
    removeUmapGraph(uGraphId: string)
    {
        this._umapGraphs.delete(uGraphId);
    }
    getUmapGraphById(uGraphId: string): UmapGraph | undefined
    {
        return this._umapGraphs.get(uGraphId);
    }
    getAllUmapGraphs()
    {
        let umapGraphs: UmapGraph[] = [];
        for(const [, graph] of this._umapGraphs)
            umapGraphs.push(graph);
        return umapGraphs;
    }
    getCurrUmapGraph(): UmapGraph | undefined
    {
        return this._currUmapGraph;
    }
    setCurrUmapGraph(uGraphId: string | undefined)
    {
        if(uGraphId === undefined) 
        {
            this._currUmapGraph = undefined;
            return;
        }
        if(this.hasUmapGraph(uGraphId))
            this._currUmapGraph = this._umapGraphs.get(uGraphId);
    }


    
    // ------------------------------------------------------------------------
    // the functions below are the helper functions for quaternion space scenes
    hasQuaternionSpaceScene(qSceneId: string): boolean
    {
        return this._quaternionSpaceScenes.has(qSceneId);
    }
    addQuaternionSpaceScene(qScene: QuaternionSpaceScene)
    {
        this._quaternionSpaceScenes.set(qScene.id().value(), qScene);
    }
    removeQuaternionSpaceScene(qSceneId: string)
    {
        let qScene = this.getQuaternionSpaceSceneById(qSceneId);
        if(qScene !== undefined){
            this._quaternionSpaceScenes.delete(qScene.id().value());
            qScene.removeAllTraces();
        }
    }
    allQuaternionSpaceScenes(): QuaternionSpaceScene[]
    {
        let result: QuaternionSpaceScene[] = [];
        for(const [, qScene] of this._quaternionSpaceScenes)
            result.push(qScene);
        return result;
    }
    setCurrQuaternionSpaceScene(qSceneId: string | undefined)
    {
        if(qSceneId === undefined) 
        {
            this._currQuaternionSpaceScene = undefined;
            return;
        }
        if(this.hasQuaternionSpaceScene(qSceneId))
            this._currQuaternionSpaceScene = this._quaternionSpaceScenes.get(qSceneId);
    }
    getCurrQuaternionSpaceScene(): QuaternionSpaceScene | undefined
    {
        return this._currQuaternionSpaceScene;
    }
    getQuaternionSpaceSceneById(qSceneId: string): QuaternionSpaceScene | undefined
    {
        return this._quaternionSpaceScenes.get(qSceneId);
    }

    // ------------
    // View Syncing

    setShouldSyncViews(v: boolean) {
        this._syncViews = v;
        if (v) { this.updateCamViewpoint(this._currSyncView); }
        APP.updateUI();
    }
    shouldSyncViews(): boolean { return this._syncViews; }

    addSyncViewCallback(callback: CameraViewpointCallback) {
        this._syncViewCallbacks.push(callback);
    }

    removeSyncViewCallback(callback: CameraViewpointCallback): boolean {
        let i = this._syncViewCallbacks.indexOf(callback);
        if (i > -1) { this._syncViewCallbacks.splice(i, 1); return true; }
        return false;
    }

    currSyncViewpoint(): Readonly<CameraViewpoint> {
        return this._currSyncView;
    }

    setCurrSyncViewpoint(view: CameraViewpoint) {
        let [newPos, newRot] = view;
        let [oldPos, oldRot] = this._currSyncView;

        // Only if the view is different from the old one should you bother
        // setting it
        if ((newPos.equals(oldPos) !== true) || (newRot.equals(oldRot) !== true)) {
            if (this._syncViews === true) {
                this.updateCamViewpoint(view);
            }
            this._currSyncView = view;
        }
    }

    protected updateCamViewpoint(newCV: CameraViewpoint) {
        for (const callback of this._syncViewCallbacks) {
            callback(newCV);
        }
    }

    // -----------------------
    // Time Warp Functions

    /**
     * @returns The time warp base or undefined if there isn't one.
     */
    currTimeWarpBase = (): undefined | RobotScene => {
        return this._currTimeWarpBase
    }

    /**
     * Sets the base robot scene to use for time warping. The base scene, as
     * its name suggests, is the scene to which all other scenes are time warped
     * in relation to. In other words, the base scene is kept the same, but the
     * other scenes have their time warped in relation to it such that the frame
     * at second 10 in the base scene may now correspond to the frame at time
     * stamp 5 in one scene and the frame at time stamp 13 in another scene. The
     * point of this is to minimize the spatial distance between the objects
     * (with the same names) in different scenes over time.
     * @param baseScene The new scene to make the base scene for time warping. Set
     * to undefined if there should be no time warping.
     */
    setTimeWarpBase(baseScene?: RobotScene) {
        if (this._currTimeWarpBase === baseScene) {
            // Don't set it twice (too much work).
            return;
        }

        /**
         * Clears all time warping so that every scene has 1:1 time warping
         * (i.e. no time warping) without updating the UI/rerendering.
         */
        let setNoTimeWarpBase = () => {
            // set every scene to use no time warping
            for (const anyScene of this.allManagedRobotScenes()) {
                anyScene.setTimeWarping(undefined);
            }
            this._currTimeWarpBase = undefined;
        }

        /**
         * Helper function that clears all time warping (making it all 1:1) and
         * then updates the UI/renders.
         */
        let setNoTimeWarpBaseBeforeReturn = () => {
            setNoTimeWarpBase();
            APP.updateUI();
            APP.render();
        }

        // If scene is undefined, then every scene should have no time warping
        if (baseScene === undefined) {
            setNoTimeWarpBaseBeforeReturn();
            return;
        }

        assert(
            this.hasManagedRobotScene(baseScene),
            `You can not set the RobotSceneManager to use a scene that it does not own `
            + `as its timewarp base. Scene: ${baseScene}`
        );

        // --- Get the base's frame data

        // Get the frame bounds for the base scene

        const sampleRate = MAX_FRAMERATE / 2; // frames per second
        const startTime = this.startTime();
        const endTime = this.endTime();
        const maxSamples = Math.abs(endTime - startTime) * sampleRate;

        let times = RobotScene.frameRange(startTime, endTime, sampleRate, maxSamples);

        let baseRobotFrameDataByRobotName: Map<string, [Robot, {
            times: number[],
            // Robot Joints now go by name as well
            positions: Map<undefined | string, [undefined | undefined | RobotJoint | RobotLink, T.Vector3[]]>,
            jointAngles: Map<string, [RobotJoint, number[]]>
        }]> = new Map();

        {
            // Get frame data for only the robots and joints whose names appear
            // once in their respective lists
            let uniqueRobots = new Set(onlyUniquesBy(baseScene.robots(), (r) => r.name()));
            let baseFrameData = baseScene.frameData(times,
                // Only want the position of the robot's base
                (r) => uniqueRobots.has(r),
                // Only want RobotLink data where the links have unique names
                (r, l) => countUsing(r.links(), l, (l) => l.name()) === 1,
                // Only want RobotJoint data where the joints have unique names
                (r, j) => countUsing(r.joints(), j, (j) => j.name()) === 1,
                (r, j) => countUsing(r.articuatedJoints(), j, (j) => j.name()) === 1,
            );

            /// If there is nothing in the base scene to compare with other scenes
            /// (i.e. the number of baseComparableRobots in the base scene is 0)
            /// when time warping, then all time warping will be 1:1 (i.e. no time
            /// warping). In this case, just return.
            if (baseFrameData.keys().next().done === true) {
                setNoTimeWarpBaseBeforeReturn();
                return;
            }

            // Data wrangle the maps to now use the names of joints instead of the joints themselves

            for (const [robot, robotFrameData] of baseFrameData.entries()) {
                let posByPartName: Map<undefined | string, [ undefined | RobotJoint | RobotLink, T.Vector3[]]> = new Map();
                let anglesByJointName: Map<string, [RobotJoint, number[]]> = new Map();

                for (const [part, pos] of robotFrameData.positions) {
                    if (part === undefined) {
                        posByPartName.set(part, [part, pos]);
                    } else if (part instanceof RobotJoint) {
                        posByPartName.set(part.name(), [part, pos]);
                    } else if (part instanceof RobotLink) {
                        posByPartName.set(part.name(), [part, pos]);
                    } else {
                        throw new AssertionError({ message: "robotPart was not a boolean, RobotJoint, or RobotLink!" });
                    }
                }

                for (const [joint, angles] of robotFrameData.jointAngles) {
                    anglesByJointName.set(joint.name(), [joint, angles]);
                }

                baseRobotFrameDataByRobotName.set(robot.name(), [robot, {
                    times: robotFrameData.times,
                    positions: posByPartName,
                    jointAngles: anglesByJointName,
                }]);
            }
        }

        // Set no time warping because getting frames could be affected by the
        // current time warping
        setNoTimeWarpBase();

        // Now calculate the time warp function for each (base -> otherFrame) combination.
        for (const otherScene of this.allManagedRobotScenes()) {
            // Ignore (base -> base) combination (will always be a 1:1 timewarp i.e. no time warp)
            if (otherScene === baseScene) { continue; }

            let otherSceneFrameData: FrameData;
            {
                // Get frame data for only the robots and joints whose names appear
                // once in their respective lists
                let uniqueRobots = new Set(onlyUniquesBy(otherScene.robots(), (r) => r.name()));
                otherSceneFrameData = otherScene.frameData(times,
                    (r) =>  r.includePosInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r),
                    (r, l) => l.includePosInTimeWarpConsideration()  && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.links(), l, (l) => l.name()) === 1),
                    (r, j) => j.includePosInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.joints(), j, (j) => j.name()) === 1),
                    (r, j) => j.includeAngleInTimeWarpConsideration()  && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.articuatedJoints(), j, (j) => j.name()) === 1),
                );

                // If the comparison data for this scene is empty then there is
                // nothing to compare with the base scene so just continue to the
                // next scene.
                if (otherSceneFrameData.keys().next().done === true) {
                    continue;
                }
            }

            // All arrays are the same length (representing the same number of frames)
            // and allow you to compare (base -> otherscene) very quickly
            let comparisonMaps: ([T.Vector3[], T.Vector3[]] | [number[], number[]])[] = [];

            // Find the comparison Maps (i.e. find out what can be compared
            // between the base and this scene)
            for (const [otherSceneRobot, otherSceneRobotFrameData] of otherSceneFrameData) {
                let baseRobotFrameData = baseRobotFrameDataByRobotName.get(otherSceneRobot.name());

                if (baseRobotFrameData === undefined) {
                    // The base scene does not have a corresponding Robot so continue to the next Robot.
                    continue;
                }

                // Figure out which positions can be compared
                for (const [otherSceneRobotPart, otherScenePosition] of otherSceneRobotFrameData.positions) {
                    let baseData = baseRobotFrameData[1].positions.get(
                        otherSceneRobotPart === undefined ? undefined : otherSceneRobotPart.name()
                    );
                    if (baseData !== undefined) {
                        let basePos = baseData[1];
                        comparisonMaps.push([basePos, otherScenePosition])
                    }
                }

                // Figure out which joint angles can be compared
                for (const [otherSceneJoint, otherSceneAngles] of otherSceneRobotFrameData.jointAngles) {
                    let baseSceneJoint = baseRobotFrameData[1].jointAngles.get(otherSceneJoint.name());
                    if (baseSceneJoint !== undefined) {
                        let baseJointAngles = baseSceneJoint[1];
                        comparisonMaps.push([baseJointAngles, otherSceneAngles]);
                    }
                }
            }

            // Do the time warping
            let timeWarpObj = new DynamicTimeWarp(times, times, (ts1Val, ts2Val, ts1I, ts2I) => {
                let sum: number = 0;
                for (const [base, other] of comparisonMaps) {
                    let baseValue = base[ts1I];
                    let otherValue = other[ts2I];

                    if (typeof baseValue === "number" && typeof otherValue === "number") {
                        // Comparing joint angles
                        sum += Math.abs(baseValue - otherValue);
                    } else {
                        // Comparing positions
                        sum += (baseValue as T.Vector3).distanceTo(otherValue as T.Vector3);
                    }
                }
                return sum;
            });

            otherScene.setTimeWarping(timeWarpObj);
        }

        this._currTimeWarpBase = baseScene;
        APP.updateUI();
        APP.render();
    }

    // -----------------------
    // Controlled Robot Scenes

    addControlledRobotScene(scene: RobotScene) {
        this._controlledScenes.push(scene);
        scene.animationManager().setTime(this.currTime());
        APP.updateUI();
    }

    removeControlledRobotScene(scene: RobotScene) {
        let i = this._controlledScenes.indexOf(scene);
        if (i > -1) { this._controlledScenes.splice(i, 1); }
    }

    /**
     * Sets whether RobotCanvas objects should allow the selection of robots at
     * the moment.
     * @param b The new value.
     */
    setAllowRobotSelection(b: boolean) {
        this._allowSelections = b;
    }

    /**
     * Returns whether RobotCanvas objects should allow the selection of robots at
     * the moment.
     * @returns whether RobotCanvas objects should allow the selection of robots
     * at the moment.
     */
    allowRobotSelection(): boolean {
        return this._allowSelections;
    }

    startAnimations() {
        if(this.currTime() >= this.currEndTime())
            this.setCurrTime(this.currStartTime());
        this._animationLoop.start();
    }

    pauseAnimations() {
        this._animationLoop.stop();
    }

    restartAnimations() {
        this._animationLoop.restart();
    }

    /**
     * @returns The [currStartTime, currTime, currEndTime] of this RobotSceneManager.
     */
    currTimeRange(): [number, number, number] {
        return [this.currStartTime(), this.currTime(), this.currEndTime()];
    }

    /**
     * @returns The [startTime, currTime, endTime] of this RobotSceneManager.
     */
    absoluteTimeRange(): [number, number, number] {
        return [this.startTime(), this.currTime(), this.endTime()];
    }

    /**
     * @returns The [startTime, currStartTime, currTime, currEndTime, endTime] of this RobotSceneManager.
     */
    timeRange(): [number, number, number, number, number] {
        return [this.startTime(), this.currStartTime(), this.currTime(), this.currEndTime(), this.endTime()];
    }

    /**
     * Returns the start time (in seconds) for all the activeAnimations.
     * Note: Returns 0 if there are no activeAnimations.
     */
    startTime(): number {
        let out = Infinity;
        let minOf = (scenes:RobotScene[]) => {
            for (const scene of scenes) {
                let animManager = scene.animationManager();
                out = Math.min(animManager.startTime(), out);
            }
        }
        minOf(this._activeScenes);
        minOf(this._controlledScenes);
        if (out === Infinity) return 0;
        return out;
    }

    /**
     * Returns the start time (in seconds) of the sub-range of the total time.
     * @returns The start time of the sub-range of the total time.
     */
    currStartTime(): number {
        return this._animationLoop.startTime();
    }

    /**
     * Sets the currStartTime.
     * @param time The new currStartTime.
     */
    setCurrStartTime(time:number) {
        time = clamp(time, this.startTime(), this.endTime());
        this._animationLoop.setStartTime(time);
        this.updateAllTraces();
    }

    /**
     * Sets the current time for the animations of all the activeScenes.
     * @param time The time (in seconds) that all the Robots in all
     * activeScenes should be posed for.
     */
    setCurrTime(time:number) {
        time = clamp(time, this.startTime(), this.endTime());
        this._animationLoop.setTime(time);
    }

    /**
     * Returns the current time (in seconds) for the animations of all active
     * scenes.
     * @returns The current time (in seconds) for the animations of all active
     * scenes.
     */
    currTime(): number {
        return this._animationLoop.time();
    }

    /**
     * Returns the end time (in seconds) of the sub-range of the total time.
     * @returns The end time of the sub-range of the total time.
     */
    currEndTime(): number {
        return this._animationLoop.endTime();
    }

    /**
     * Sets the currEndTime.
     * @param time The new currEndTime.
     */
    setCurrEndTime(time:number) {
        time = clamp(time, this.startTime(), this.endTime());
        this._animationLoop.setEndTime(time);
        this.updateAllTraces();
    }

    /**
     * Returns the end time (in seconds) for all the activeAnimations.
     * Note: Returns 1 if there are no activeAnimations.
     */
    endTime(): number {
        let out = -Infinity;
        let maxOf = (scenes: RobotScene[]) => {
            for (const scene of scenes) {
                let animManager = scene.animationManager();
                out = Math.max(animManager.endTime(), out);
            }
        }
        maxOf(this._activeScenes);
        maxOf(this._controlledScenes);
        if (out === -Infinity) return 1;
        return out;
    }

    updateAllTraces()
    {
        for(const robotScene of this.allManagedRobotScenes())
            robotScene.updateTraces();
        for(const qScene of this.allQuaternionSpaceScenes())
                qScene.updateTraces();
    }

    updateAllTraceSymbols()
    {
        for(const qScene of this.allQuaternionSpaceScenes())
            qScene.updateTraceSymbols();
    }
    /**
     * Returns the RobotScene with the given id, or undefined if one with the
     * given id could not be found.
     * @param id the value of the id of the RobotScene you want to get from the
     * RobotSceneManager.
     */
    robotSceneById(id: string): RobotScene | undefined {
        for (const [,robotScene,] of this._availableScenes) {
            if (robotScene.id().value() === id) {
                return robotScene;
            }
        }
        return undefined;
    }

    /**
     * Returns the current RobotScene.
     * @param canBeUndefined Whether the result can be undefined or this method
     * should return a new default RobotScene upon failure to find an active one
     * to return.
     */
    currRobotScene(canBeUndefined: false): RobotScene;
    currRobotScene(canBeUndefined?: true): undefined | RobotScene;
    currRobotScene(canBeUndefined?: boolean): undefined | RobotScene {
        if (canBeUndefined === true || canBeUndefined === undefined) {
            return this._currScene;
        } else {
            if (this._currScene) {
                return this._currScene;
            } else {
                // No active or available scenes and cannot be undefined
                let newScene = this.addDefaultManagedRobotScene();
                this.setCurrRobotScene(newScene);
                return newScene;
            }
        }
    }

    /**
     * Sets the currently-selected RobotScene to the given RobotScene.
     * @param robotScene The RobotScene to set to be the currently-selected
     * RobotScene.
     */
    setCurrRobotScene(robotScene: RobotScene | undefined) {
        this._currScene = robotScene;
        APP.updateUI();
    }

    /**
     * Master Robots are those from which the Robots in the RobotScene objects
     * have been cloned from. This means that, for deserialization, the masters
     * can be saved and the clones only need to say what master they are from
     * and what changes (i.e. what x,y,z placement, rotation, etc. have been
     * changed) have been made to the master for this particular clone of it.
     * @returns The array of master Robot objects.
     */
    masterRobots(): ReadonlyArray<Robot> {
        return this._masterRobots;
    }

    addMasterRobot(robot:Robot) {
        let i = this._masterRobots.indexOf(robot);
        if (i === -1) {
            this._masterRobots.push(robot);
            APP.updateUI();
        }
    }

    removeMasterRobot(robot:Robot) {
        let i = this._masterRobots.indexOf(robot);
        if (i > -1) {
            this._masterRobots.splice(i, 1);
            APP.updateUI();
        }
    }

    /**
     * Sorts the RobotScenes of this RobotSceneManager by its paths.
     * 
     * This method does nothing if this RobotSceneManager is already sorted.
     * @param force whether to force the sort to happen or only sort if it is
     * not already sorted.
     */
    sortScenes(force:boolean=false) {
        if (force || (!this._isSorted)) {
            this._availableScenes.sort((a, b) => {
                return a[0].join('').localeCompare(b[0].join(''));
            });

            let colors = sceneColorRamp.colors(this._availableScenes.length);
            for (const [i, [, scene]] of enumerate(this._availableScenes)) {
                scene.setColor(colors[i]);
            }
            this._isSorted = true;
        }
    }

    /**
     * Animation tables are as their name suggests and hold animation data from
     * a CSV. This method returns a master list of all AnimationTables
     * that have been loaded into the application.
     * @returns A list of all available AnimationTable objects.
     */
    animationTables():ReadonlyArray<AnimationTable> {
        return this._animationTables;
    }

    addAnimationTable(at:AnimationTable) {
        if (this._animationTables.indexOf(at) !== -1) return;
        this._animationTables.push(at);
        APP.updateUI();
    }

    removeAnimationTable(at:AnimationTable) {
        let i = this._animationTables.indexOf(at);
        if (i > -1) {
            this._animationTables.splice(i, 1);
            APP.updateUI();
        }
    }

    /**
     * Removes the robot scene with the given path from the RobotSceneManager,
     *   returning it on success and returning undefined otherwise.
     */
    removeRobotScene(robotScene:RobotScene): undefined | RobotScene {
        // First, make sure that the scene is even managed by this
        // RobotSceneManager and ignore it if it isn't
        let i = -1;
        let _i = 0;
        while (_i < this._availableScenes.length) {
            const [, scene,] = this._availableScenes[_i];
            if (scene === robotScene) {
                i = _i;
                break;
            }
            _i += 1;
        }

        if (i <= -1) {
            // given robotScene is not managed by this RobotSceneManager
            return undefined;
        }

        let [,res,] = this._availableScenes.splice(i, 1)[0];
        if (res && this.isActiveRobotScene(res)) {
            // Remove all instances of this RobotScene from the activeScenes list
            let found = true;
            while (found) {
                found = this.deactivateRobotScene(res) !== undefined;
            }
            res.setParentRobotSceneManager(undefined);
            return res;
        }

        // If there is another RobotScene available, select it
        if (this._availableScenes.length > 0) {
            if ((i - 1) >= 0) {
                this.setCurrRobotScene(this._availableScenes[i - 1][1]);
            } else {
                this.setCurrRobotScene(this._availableScenes[i][1]);
            }
        }

        if (robotScene === this._currTimeWarpBase) {
            this.setTimeWarpBase(undefined);
        }

        APP.updateUI();
    }

    /**
     * Adds a number of robotScenes to the RobotSceneManager.
     * 
     * @param scenes A list of RobotScenes that should now be managed by the RobotScenemanager.
     * 
     * Each given scene has a number of components that must be given with it:
     *  * path: The path to the RobotScene.
     *  * robotScene: The RobotScene to add under the given path.
     *  * metrics: The metrics to associate with the RobotScene (can be anything because it is just meta-information).
     */
    addManagedRobotScenes(scenes: { path:string[], robotScene:RobotScene, metrics?:Map<string, string> }[]) {
        for (const scene of scenes) {
            this._availableScenes.push([scene.path, scene.robotScene, scene.metrics ?? new Map()]);
            this._isSorted = false;
            scene.robotScene.animationManager().setTime(this.currTime()); // update the animation to be correct
            APP.updateUI();
        }

        // Recalc time warps
        APP.recalculateTimeWarping();
    }

    /**
     * Returns the given managed robot scene and its information.
     * @param scenes The scene whose information you want to get.
     * @returns the given scene's data or undefined if the scene was not found
     * in this RobotSceneManager.
     */
    getManagedRobotSceneData(scene: Readonly<RobotScene>): undefined | Readonly<{ path: readonly string[], robotScene: Readonly<RobotScene>, metrics:  Readonly<Map<string, string>> }> {
        let out = this._availableScenes.filter(([,availScene,]) =>
            availScene === scene
        )[0];
        if (out) {
            let [path, robotScene, metrics] = out;
            return { path, robotScene, metrics }
        }
        return;
    }

    /**
     * Creates the default RobotScene and adds it to this RobotSceneManager.
     */
    addDefaultManagedRobotScene():RobotScene {
        let defaultRobotScene = new RobotScene(this);
        this.addManagedRobotScenes([{path: [], robotScene: defaultRobotScene}]);
        return defaultRobotScene;
    }

    /**
     * @returns An array of all robot scenes that are currently managed by this
     * RobotSceneManager.
     */
    allManagedRobotScenes(): readonly RobotScene[] {
        return this._availableScenes.map(([, scene, ]) => scene);
    }

    /**
     * Returns true if the RobotScene is managed by this RobotSceneManager and false otherwise.
     * @param robotScene The RobotScene.
     * @returns true if the RobotScene is managed by this RobotSceneManager and
     * false otherwise.
     */
    hasManagedRobotScene(robotScene:RobotScene): boolean {
        let i = -1;
        for (const [_i, [,scene,]] of enumerate(this._availableScenes)) {
            if (scene === robotScene) {
                i = _i;
                break;
            }
        }
        return i > -1;
    }

    /**
     * Returns true if the given RobotScene is active and false otherwise.
     * @param robotScene The RobotScene to check if active.
     * @returns True if the given RobotScene is active and false otherwise.
     */
    isActiveRobotScene(robotScene:RobotScene): boolean {
        return this._activeScenes.indexOf(robotScene) > -1;
    }

    /**
     * Returns the list of currently active RobotScenes.
     * 
     * Note: the list can have duplicate RobotScenes in it.
     * @returns The list of currently active RobotScenes.
     */
    activeRobotScenes(): ReadonlyArray<RobotScene> {
        return this._activeScenes;
    }

    /**
     * Activates the given RobotScene i.e. declares that it is in use as a tab.
     * Note: this also sets it as the currRobotScene.
     * 
     * Note: You can activate the same RobotScene multiple times so make sure to
     * deactivate it when you are done.
     * @param robotScene The RobotScene or path to the RobotScene to make active.
     * @throws Error if the RobotScene cannot be found.
     */
    activateRobotScene(robotScene:string[] | RobotScene): void {
        if (Array.isArray(robotScene)) {
            for (const [path, _robotScene,] of this._availableScenes) {
                if (eqStrList(path, robotScene)) {
                    this._activeScenes.push(_robotScene);
                    this.setCurrEndTime(this.endTime());
                    APP.updateUI();
                    return;
                }
            }
            throw Error(
                `RobotScene under path ${robotScene} could not be found and switched to by the RobotSceneManager.`
            );
        } else {
            for (const [, _robotScene,] of this._availableScenes) {
                if (_robotScene === robotScene) {
                    this._activeScenes.push(_robotScene);
                    this.setCurrEndTime(this.endTime());
                    APP.updateUI();
                    return;
                }
            }
            throw Error(
                `RobotScene could not be found and switched to by the RobotSceneManager.`
            );
        }
    }

    /**
     * Deactivates the given RobotScene.
     * 
     * Note: A RobotScene can be activated multiple times so it can also be
     * deactivated multiple times.
     * 
     * @param robotScene The RobotScene (or path to a RobotScene) to deactivate.
     * @returns The deactivated RobotScene (if found) or undefined if it could
     * not be deactivated.
     */
    deactivateRobotScene(robotScene:string[] | RobotScene): RobotScene | undefined {
        if (Array.isArray(robotScene)) {
            for (const [i, [path,,]] of enumerate(this._availableScenes)) {
                if (eqStrList(path, robotScene)) {
                    let res = this._availableScenes.splice(i, 1)[0][1];
                    APP.updateUI();
                    return res;
                }
            }
            return undefined;
        } else {
            let i = this._activeScenes.indexOf(robotScene);
            if (i > -1) {
                let res = this._activeScenes.splice(i, 1)[0];
                APP.updateUI();
                return res;
            } else {
                return undefined;
            }
        }
    }

    /**
     * Loads in sessions from the given URL.
     * @param url The url to fetch the sessions from.
     */
    async loadSessionFromURL(url:string, onRestoreLayout?: (savedLayout: LayoutBase | undefined) => void):Promise<void> {
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, location: url, type: "workspace" });

        try {
            // fetch the data
            let res = await fetch(url, { method: "GET", });
            // load the data
            await this.loadSession(await res.json(), onRestoreLayout)
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess, location: url, type: "workspace" })
        } catch(e) {
            // failed to load
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingFailed, location: url, type: "workspace" });
            throw e;
        }
    }

    /**
     * Yields the contents of this RobotSceneManager.
     */
    * content():Generator<[string[], RobotScene, Map<string, string>], void, void> {
        this.sortScenes();
        for (const c of this._availableScenes) {
            yield [...c]; // copy of array so can't affect origional
        }
    }

    /**
     * Saves the Scenes of this RobotSceneManager to the user's downloads.
     * Note: the layout will be saved in the save and load session
     */
    saveSession(): sessions_import_format {
        // Object and animations are each unique and will be loaded on startup
        const robotsByURL = new Map<string, Robot>();
        const robotsById = new Map<string, Robot>();
        const objects:sessions_import_format["objects"] = [];

        const animTablesByURL = new Map<string, AnimationTable>();
        const animTablesById = new Map<string, AnimationTable>();
        const animations:sessions_import_format["animations"] = [];

        const scenes:sessions_import_format["scenes"] = [];

        const animsForRobotsByID = new Map<string, string[]>();

        // On a scene-by-scene basis
        for (const [path, rScene, metrics] of this.content()) {
            let robs = rScene.robots();
            // Handle all instances of robots and save the unique ones to the "objects" array
            let threeObjects: sessions_import_format["scenes"][number]["threeObjects"] = [];
            let traces: sessions_import_format["scenes"][number]["traces"] = [];
            let arrows: sessions_import_format["scenes"][number]["arrows"] = [];
            for (const robot of robs) {
                let id = robot.idValue();
                let url = robot.url();
                let name = robot.name();

                // we don't need to save the world fame becuase it's added to every scene by default
                if (name === "World Frame") {
                    continue;
                }

                let anims:string[] = [];
                animsForRobotsByID.set(id, anims);

                if (url === undefined) {
                    APP.error(`Cannot save robot with name "${robot.name()}" because it does not come from a URL`);
                    continue;
                }

                let masterRobot = robotsByURL.get(url);
                if (masterRobot === undefined) {
                    masterRobot = robotsById.get(id);
                }

                // Figure out if this robot is from the same URDF or GLB as one
                // before it. If it is, then use the url and ID from the origional
                if (masterRobot === undefined) {
                    // This robot has not been seen before so we must save it
                    if (url !== undefined) {
                        robotsByURL.set(url, robot);
                    }
                    robotsById.set(id, robot);


                    let type: 'urdf' | 'gltf' | 'AxesHelper';
                    if (robot.objectType() === 'urdf') {
                        type = 'urdf';
                    } else if (robot.url() !== 'AxesHelper') {
                        type = 'gltf';
                    } else {
                        type = 'AxesHelper';
                    }
                    objects.push({
                        type: type,
                        id: id,
                        url: url,
                        name: name,
                    });
                } else {
                    id = masterRobot.idValue();
                    let _url = masterRobot.url();
                    if (_url !== undefined) {
                        url = _url;
                    }
                }

                // Save the information pertaining to this instance of a robot
                let joints:{
                    name:string,  // must match up with the name of the joint in the URDF
                    angle:number, // These should be radians
                }[] = [];

                for (const [name, joint] of robot.getArticuatedJointMap().entries()) {
                    joints.push({
                        name: name,
                        angle: joint.angle(),
                    });
                }

                // Push the final object
                threeObjects.push({
                    objectID: id,
                    robotID: robot.id().value(),
                    isviewpoint: false,
                    animationID: anims, // List of animations for this ThreeObject
                    name: robot.name(),

                    position: toXYZ(robot.getPosition()),
                    rotation: toXYZW(robot.getQuaternion()),
                    scale:    toXYZ(robot.getScale()),
                    joints: joints,

                    positionOffset: toXYZ(robot.getPositionOffset()),
                    rotationOffset: toXYZW(robot.getQuaternionOffset()),
                    scaleOffset:    toXYZ(robot.getScaleOffset()),
                });
            }

            // Handle all animations for this scene
            for (const group of rScene.animationManager().animationGroups()) {
                for (const anim of group.animations()) {
                    let animTable = anim.animationTable();

                    let id = animTable.idValue();
                    let url = animTable.url();

                    let masterAnimTable = animTablesById.get(id);
                    if (masterAnimTable === undefined && url !== undefined) {
                        masterAnimTable = animTablesByURL.get(url);
                    }

                    if (masterAnimTable === undefined) {
                        // Master could not be found, so this animationTable
                        // should become the master (become the only
                        // animationTable saved)

                        animTablesById.set(animTable.idValue(), animTable);
                        let _url = animTable.url();
                        if (_url !== undefined) {
                            animTablesByURL.set(_url, animTable);
                            url = _url;
                        }

                        animations.push({
                            name: animTable.name(),
                            id: id,
                            timeUnit: "second",
                            url: url, // string or undefined
                            content: animTable.toCSV()
                        });
                    } else {
                        id = masterAnimTable.idValue();
                        //url = masterAnimTable.url();
                    }

                    let animsForRobot = animsForRobotsByID.get(anim.objectAnimating().idValue());
                    if (animsForRobot === undefined) {
                        APP.error(`Could not save an AnimationTable because the object it animates could not be saved previously.`);
                        continue;
                    }
                    animsForRobot.push(id);
                }
            }

            // save all traces
            for(const trace of rScene.getAllTraces())
            {
                let robotPartName = trace.robotPart()?.name();
                let parentSceneId = trace.robot().parentScene()?.id().value();
                let currSceneId = rScene.id().value();
                if(parentSceneId === undefined || currSceneId === undefined) continue;
                if(robotPartName === undefined) robotPartName = ""; // the robot itself
                // console.log(trace.robot().parentScene());
                // console.log(trace.robot().idValue());
                traces?.push({
                    robotId: trace.robot().idValue(),
                    robotPartName: robotPartName,
                    parentSceneId: parentSceneId,
                    currSceneId: currSceneId,
                    originalId: trace.id(),
                });
            }

            // save all arrows
            for(const arrow of rScene.getAllArrows())
            {
                arrows?.push({
                    traceFromId: arrow.traceFrom().id(),
                    traceToId: arrow.traceTo().id(),
                    parentSceneId: rScene.id().value(),
                });
            }

            let out_metrics:{[key:string]: string} = {};
            for (const [key, value] of metrics.entries()) {
                out_metrics[key] = value;
            }

            // console.log(rScene.name());
            // console.log(threeObjects);
            scenes.push({
                name: rScene.name(),
                originalId: rScene.id().value(),
                path: path,
                metrics: out_metrics,
                threeObjects: threeObjects,
                traces: traces,
                backgroundColor: rScene.backgroundColor(),
                directionalLightIntensity: rScene.directionalLightIntensity(),
                ambientLightIntensity: rScene.ambientLightIntensity(),
                showGroundPlane: rScene.isGroundPlaneVisible(),
                cameraType: rScene.cameraType(),
                worldFrame: rScene.worldFrame(),
                showWorldFrameObject: rScene.isWorldFrameObjectVisible(),
                axisDensity: rScene.density(),
                axisSize: rScene.axisSize(),
                traceSize: rScene.traceSize(),
                isTimeWarped: rScene.isTimeWarping(),
                timeWarpBaseSceneId: rScene.baseSceneId(),
                keyObjects: rScene.keyObjects(),
                arrows: arrows,
            });
        }

        // save all quaternion scenes and their traces
        const quaternionScenes:sessions_import_format["quaternionScenes"] = [];
        for(const quaternionScene of this.allQuaternionSpaceScenes())
        {
            type myQuaternionScenes = {
                name: string,
                originalId: string,
                backgroundColor: string,
                lineGroupOpacity: number,
                lineGroupColor: string,

                traces: {
                    robotId: string,
                    robotPartName: string,
                    parentSceneId: string,
                }[],
            }[];
            // use myQuaternionScenes instead of sessions_import_format["quaternionScenes"] as
            // sessions_import_format["quaternionScenes"] can be undefined
            let traces: myQuaternionScenes[number]["traces"] = [];
            for(const trace of quaternionScene.getAllTraces())
            {
                let robotPartName = trace.robotPart()?.name();
                let parentSceneId = trace.robot().parentScene()?.id().value();
                if(parentSceneId === undefined) continue;
                if(robotPartName === undefined) robotPartName = ""; // the robot itself
                traces?.push({
                    robotId: trace.robot().idValue(),
                    robotPartName: robotPartName,
                    parentSceneId: parentSceneId,
                });
            }

            quaternionScenes.push({
                name: quaternionScene.name(),
                originalId: quaternionScene.id().value(),
                backgroundColor: quaternionScene.backgroundColor(),
                lineGroupOpacity: quaternionScene.lineGroupOpacity(),
                lineGroupColor: quaternionScene.lineGroupColor(),
                traces: traces,
                showWorldFrameObject: quaternionScene.isWorldFrameObjectVisible(),
            });
        }


        // save all graphs and their curves
        const graphs:sessions_import_format["graphs"] = [];
        for(const graph of this.getAllGraphs())
        {
            type myGraphs = {
                name: string,
                isDiff: string,
                isTimeWarp: string,
        
                currProperty: string,
                line_ids: string[],
                lineWidth: number, 
                backgroundColor: string, 
                axisColor: string,
                filter: number, 
            }[];
            // use myGraphs instead of sessions_import_format["graph"] as
            // sessions_import_format["graph"] can be undefined
            let line_ids: myGraphs[number]["line_ids"] = [];
            for(const line_id of graph.lineIds())
            {
                line_ids.push(line_id);
            }
            graphs.push({
                name: graph.name(),
                originalId: graph.id(),
                isDiff: graph.isDiff(),
                isTimeWarp: graph.isTimeWarp(),
                line_ids: line_ids,
                currProperty: graph.currProperty(),
                lineWidth: graph.lineWidth(),
                axisColor: graph.axisColor(),
                backgroundColor: graph.backgroundColor(),
                filter: graph.filter(),
            });
        }

        // save all umap graphs and their curves
        const umapGraphs:sessions_import_format["umapGraphs"] = [];
        for(const umapGraph of this.getAllUmapGraphs())
        {
            type myUmapGraphs = {
                name: string,
                originalId: string,
        
                line_ids: string[],
                
                lineWidth: number, // the stoke size of the curves displayed in the graph
                backgroundColor: string, // the background color of the graph
                axisColor: string, // the axis color of the graph
            }[];
            // use myUmapGraphs instead of sessions_import_format["umapGraph"] as
            // sessions_import_format["umapGraph"] can be undefined
            let line_ids: myUmapGraphs[number]["line_ids"] = [];
            for(const line_id of umapGraph.lineIds())
                line_ids.push(line_id);

            umapGraphs.push({
                name: umapGraph.name(),
                originalId: umapGraph.id(),
                line_ids: line_ids,
                lineWidth: umapGraph.lineWidth(),
                axisColor: umapGraph.axisColor(),
                backgroundColor: umapGraph.backgroundColor(),
            });
        }

        return {
            saveFormatVersion: "1.0",
            times: {
                currentTime: this.currTime(),
                currentEndTime: this.currEndTime(),
                currentStartTime: this.currStartTime(),
            },
            quaternionScenes: quaternionScenes,
            objects: objects,
            animations: animations,
            scenes: scenes,
            graphs: graphs,
            umapGraphs: umapGraphs,
        };
    }

    /**
     * Loads a Robot into the RobotScene from a local file.
     * @param file The local json file to find and load into the RobotScene.
     * @returns A promise that resolves when the json was successfully loaded.
     */
    async loadSessionFromLocalFile(file:File, onRestoreLayout?: (savedLayout: LayoutBase | undefined) => void):Promise<void> {
        APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted, location: file.name, type: "workspace" });
        try {
            // fetch the json data
            let json = (await loadJsonFromLocalFile(file)) as sessions_import_format;
            // load the json data
            await this.loadSession(json, onRestoreLayout);
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess, location: file.name })
        } catch(e) {
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingFailed, location: file.name, type: "workspace" })
            throw e;
        }
    }

    /**
     * Loads in the sessions from the given session format.
     * @param sessions The sessions to load in.
     */
    protected async loadSession(sessions:sessions_import_format, onRestoreLayout?: (savedLayout: LayoutBase | undefined) => void):Promise<void> {
        let version = sessions.saveFormatVersion;

        if (version === undefined || version === "1.0") {
            // const loadingMessage = `Loading`;
            // const loadingElement = document.createElement("p");
            // loadingElement.innerText = loadingMessage;
            // loadingElement.style.color = "yellow";
            // loadingElement.classList.add("LoadingMessage");
            // const panelElement = document.querySelector(".Workspace");
            // panelElement?.insertBefore(loadingElement, panelElement?.firstChild);

            await this.loadV1Session(sessions, onRestoreLayout);

            // const messageElements = document.querySelectorAll('.LoadingMessage');
            // messageElements.forEach(element => {
            //     if (element.parentNode) {
            //         element.parentNode.removeChild(element);
            //     }
            // });
        } else {
            APP.error(`Could not load in workspace with unknown version number "${version}"`);
            return;
        }

        // Remove all empty "Default" Scenes so that they do not get in the way of
        // the newly-loaded scenes
        let i = 0;
        while (i < this._availableScenes.length) {
            let [path, rScene,] = this._availableScenes[i];
            if (path.length === 0 && rScene.robots().length === 0) {
                this.removeRobotScene(this._availableScenes[i][1]);
                continue;
            }
            i += 1;
        }
    }

    async loadV1Session(sessions:sessions_import_format, onRestoreLayout?: (savedLayout: LayoutBase | undefined) => void):Promise<void> {
        // console.log(sessions);
        // Begin the loading of all object promises
        let objectProms:[string, Promise<Robot>][] = [];
        for (const object of sessions.objects) {
            if (object.type.toUpperCase() === "URDF") {
                objectProms.push([object.id, Robot.loadRobot(object.url, 'urdf', object.name)]);
            } else if (object.type.toUpperCase() === "GLTF") {
                objectProms.push([object.id, Robot.loadRobot(object.url, 'glb', object.name)]);
            } else {
                objectProms.push([object.id, Robot.loadRobot(object.url, 'axesHelper', object.name)]);
            }
                
        }

        let allAnimationTables:AnimationTable[] = [];

        // Begin the loading of all animation promises
        let animationProms:[string, Promise<AnimationTable>][] = [];
        for (const animation of sessions.animations) {
            let contents = animation.content;
            let id = animation.id;
            let url = animation.url;
            let name:string = animation.name ?? "Unnamed Animation";
            let prom:undefined | Promise<AnimationTable>;
            let timeUnit = animation.timeUnit;

            if (contents) {
                let c = contents; // bind it to current scope
                prom = new Promise((resolve, reject) => {
                    let at = AnimationTable.fromCSV(c, timeUnit);
                    if (!(at instanceof AssertionError)) {
                        at.id().set(id);
                        at.setName(name);
                        resolve(at);
                    } else {
                        reject(at);
                    }
                });
            } else if (url) {
                let u = url;
                prom = (async function ():Promise<AnimationTable> {
                    let CSVs = (await loadCSVFromURL(u));

                    if (CSVs.length === 0) {
                        let at = AnimationTable.fromCSV(CSVs[0], timeUnit);
                        if (!(at instanceof AssertionError)) {
                            at.id().set(id);
                            at.setName(name);
                            return at;
                        }
                        throw new Error(`CSV from url ${u} was il-formatted and could not be used.`);
                    }
                    throw Error(`Expected exactly 1 CSV from url ${u}, got ${CSVs.length}.`);
                })();
                
            } else {
                throw Error(`Expected url and/or some content for an animation, but got neither.`);
            }

            animationProms.push([id, prom]);
        }

        /**
         * Returns a promise that returns a [string, and the result of the promise]
         * @param proms The list of promises to await
         * @returns A promise that returns a [string, and the result of the promise]
         */
        async function awaitIdProms<T>(proms:[string, Promise<T>][]):Promise<[string, T][]> {
            let out:[string, T][] = [];
            for (const [id, prom] of proms) {
                out.push([id, await prom]);
            }
            return out;
        }

        // Await all Robots to be loaded, then await all animations
        let objects:Map<string, Robot> = new Map();
        let animations:Map<string, AnimationTable> = new Map();

        for (const [objectId, object] of (await awaitIdProms(objectProms))) {
            objects.set(objectId, object)
            object.id().regen(); // new unique ID because old one was just for loading in objects to this package -- ID in map can be used
        }

        for (const [animationId, animation] of (await awaitIdProms(animationProms))) {
            animations.set(animationId, animation); // new unique ID for same reason that object needs one
            animation.id().regen();
            allAnimationTables.push(animation);
        }

        // Now create each RobotScene (add them to list, then add list because
        // even if the first few are successful the other ones)
        let robotScenes:{ path:string[], robotScene:RobotScene, metrics?:Map<string, string> }[] = [];
        let sceneIdMap: Map<string, string> = new Map(); // map the original id to the new id,
        let robotIdMap: Map<string, Map<string, string>> = new Map();
        for (const scene of sessions.scenes) {
            let robotScene = new RobotScene(this);
            let robotIds: Map<string, string> = new Map();
            if(scene.originalId !== undefined)
            {
                sceneIdMap.set(scene.originalId, robotScene.id().value());
                robotIdMap.set(robotScene.id().value(), robotIds);
            }
            

            // set robot scene attributes
            if(scene.name !== undefined)
                robotScene.setName(scene.name);
            if(scene.backgroundColor !== undefined)
                robotScene.setBackgroundColor(scene.backgroundColor);
            if (scene.directionalLightIntensity !== undefined)
                robotScene.setDirectionalLightIntensity(scene.directionalLightIntensity);
            if (scene.ambientLightIntensity !== undefined)
                robotScene.setAmbientLightIntensity(scene.ambientLightIntensity);
            if (scene.showGroundPlane !== undefined)
                robotScene.setGroundPlaneVisibility(scene.showGroundPlane);
            if (scene.cameraType !== undefined)
                robotScene.setCameraType(scene.cameraType);
            if (scene.worldFrame !== undefined)
                robotScene.setWorldFrame(scene.worldFrame);
            if (scene.showWorldFrameObject !== undefined)
                robotScene.setWorldFrameObjectVisibility(scene.showWorldFrameObject);
            if (scene.axisDensity !== undefined)
                robotScene.setDensity(scene.axisDensity);
            if (scene.axisSize !== undefined)
                robotScene.setAxisSize(scene.axisSize);
            if (scene.traceSize !== undefined)
                robotScene.setTraceSize(scene.traceSize);

            let animationGroup = new AnimationGroup('Animation Group');

            let path = scene.path;

            let metrics:Map<string, string> = new Map();
            for (const [key, value] of Object.entries(scene.metrics)) {
                metrics.set(key, value);
            }

            for (const obj of scene.threeObjects) {
                let objectID = obj.objectID;
                let robot = objects.get(objectID);
                if (robot === undefined) {
                    throw new Error(`Unable to load in sessions: There was no object with ID "${objectID}"`);
                }
                let copy:Robot = robot.clone();
                copy.setName(obj.name);
                copy.id().regen(); // Needs new Id so that this object's ID does not conflict with old one
                if(obj.robotID !== undefined)
                    robotIds.set(obj.robotID, copy.idValue());
                copy.setScale(fromXYZ(copy.getScaleOffset().clone(), obj.scale));
                copy.setPosition(fromXYZ(copy.getPositionOffset().clone(), obj.position));

                let rotation = obj.rotation;
                if (rotation !== undefined) {
                    if (rotation.w !== undefined) {
                        copy.setQuaternion(fromXYZW(copy.getQuaternionOffset().clone(), obj.rotation));
                    } else {
                        copy.setQuaternion(fromXYZ(copy.getQuaternionOffset().clone(), obj.rotation));
                    }
                }

                // Set Absolute Values
                copy.setScaleOffset(fromXYZ(copy.getScaleOffset().clone(), obj.scaleOffset));
                copy.setPositionOffset(fromXYZ(copy.getPositionOffset().clone(), obj.positionOffset));

                rotation = obj.rotationOffset;
                if (rotation !== undefined) {
                    if (rotation.w !== undefined) {
                        copy.setQuaternionOffset(fromXYZW(copy.getQuaternionOffset().clone(), obj.rotationOffset));
                    } else {
                        copy.setQuaternionOffset(fromXYZ(copy.getQuaternionOffset().clone(), obj.rotationOffset));
                    }
                }

                // Set joints
                if (obj.joints) {
                    for (const joint of obj.joints) {
                        copy.setJointAngle(joint.name, joint.angle);
                    }
                }

                robotScene.addChildRobot(copy);

                // Bind animations

                for (const animationID of obj.animationID) {
                    let animation = animations.get(animationID);

                    if (animation) {
                        animationGroup.addAnimation(new Animation(copy, animation))
                    }
                }
            }

            robotScene.animationManager().addActiveAnimation(animationGroup);
            robotScenes.push({ path: path, robotScene: robotScene, metrics: metrics });
        }

        let _finalRobotScene = robotScenes.at(robotScenes.length - 1);
        let finalRobotScene = undefined;
        if (_finalRobotScene !== undefined) { finalRobotScene = _finalRobotScene.robotScene; }

        // Add scenes to the actual RobotSceneManager now that they have all
        // been successfully loaded in
        this.addManagedRobotScenes(robotScenes);

        for (const animTable of allAnimationTables) {
            this.addAnimationTable(animTable);
        }

        for (const master of objects.values()) {
            this._masterRobots.push(master);
        }

        if (finalRobotScene) {
            this.setCurrRobotScene(finalRobotScene);
        }

        // activate all scenes
        for (const scene of this.allManagedRobotScenes())
        {
            if(!this.isActiveRobotScene(scene))
                this.activateRobotScene(scene);
        }

        // set the times
        if(sessions.times !== undefined)
        {
            this.setCurrStartTime(sessions.times.currentStartTime);
            this.setCurrEndTime(sessions.times.currentEndTime);
            this.setCurrTime(sessions.times.currentTime);
        }


        // restore the time warp scenes
        for(const scene of sessions.scenes)
        {
            if(scene.isTimeWarped !== undefined && scene.timeWarpBaseSceneId !== undefined 
                && scene.keyObjects !== undefined && scene.isTimeWarped === true 
                && scene.originalId !== undefined)
            {
                let baseSceneId = this.findNewSceneId(scene.timeWarpBaseSceneId, sceneIdMap);
                let robotSceneId = this.findNewSceneId(scene.originalId, sceneIdMap);
                if(baseSceneId === undefined || robotSceneId === undefined) continue;
                let baseScene = this.robotSceneById(baseSceneId);
                let robotScene = this.robotSceneById(robotSceneId);
                if(baseScene === undefined || robotScene === undefined) continue;

                
                // Note: this part is copied from SceneOptionPanel where users tried to create
                // a time warp scene
                for (const keyObject of scene.keyObjects) {
                    const [robotName, content] = keyObject.split("\n");
                    const [robotPartName, typeName] = content.split(" ");
                    // console.log(robotPartName);
                    // console.log(typeName);
                    if (robotPartName.length === 0) // robot itself as a key object
                    {
                        // console.log(robotName);
                        let robot = robotScene.getRobotByName(robotName);
                        robot?.setPositionIncludeInTimeWarpConsideration(true);
                    }
                    else {
                        let robotPart: RobotJoint | RobotLink | undefined = robotScene.getJointByName(robotName, robotPartName);
                        if (robotPart === undefined) {
                            robotPart = robotScene.getLinkByName(robotName, robotPartName);
                            robotPart?.setPosIncludeInTimeWarpConsideration(true);
                        }
                        else {
                            if (typeName == "angle")
                                robotPart.setAngleIncludeInTimeWarpConsideration(true);
                            else
                                robotPart.setPosIncludeInTimeWarpConsideration(true);
                        }
                    }

                    // recalculate time warp
                    robotScene.setTimeWarpBase(undefined);
                    robotScene.setTimeWarpBase(baseScene);
                }
                robotScene.setKeyObjects(scene.keyObjects);
            }
        }
    
        // add traces to the scenes
        let traceIdMap: Map<string, string> = new Map();
        for (const scene of sessions.scenes)
        {
            if(scene.traces === undefined) continue;
            for(const trace of scene.traces)
            {
                
                let robotPartName = trace.robotPartName;
                let parentSceneId = this.findNewSceneId(trace.parentSceneId, sceneIdMap);
                if(parentSceneId === undefined) continue;

                let currSceneId = this.findNewSceneId(trace.currSceneId, sceneIdMap);
                if(currSceneId === undefined) continue;

                let robotId = this.findNewRobotId(trace.robotId, robotIdMap, parentSceneId);
                if(robotId === undefined) continue;

                this.addTracesToRobotScene(currSceneId, parentSceneId, robotId, robotPartName, traceIdMap, trace.originalId);
            }
        }

        // restore all the arrows
        for (const scene of sessions.scenes)
        {
            if(scene.arrows === undefined) continue;
            for(const arrow of scene.arrows)
            {
                console.log(arrow);
                let parentSceneId = this.findNewSceneId(arrow.parentSceneId, sceneIdMap);
                if(parentSceneId === undefined) continue;
                let parentScene = this.robotSceneById(parentSceneId);
                if(parentScene === undefined) continue;
                let traceFromId = this.findNewTraceId(arrow.traceFromId, traceIdMap);
                let traceToId = this.findNewTraceId(arrow.traceToId, traceIdMap);
                if(traceFromId !== undefined && traceToId !== undefined)
                    parentScene.addArrow(traceFromId, traceToId);
            }
        }


        // restore quaternion space scenes and their traces
        let qSceneIdMap: Map<string, string> = new Map(); // map the original id to the new id,
        if(sessions.quaternionScenes !== undefined)
        {
            for(const qScene of sessions.quaternionScenes)
            {
                let quaternionScene = new QuaternionSpaceScene(this);
                quaternionScene.setName(qScene.name);
                quaternionScene.setBackgroundColor(qScene.backgroundColor);
                quaternionScene.setLineGroupOpacity(qScene.lineGroupOpacity);
                quaternionScene.setLineGroupColor(qScene.lineGroupColor);
                quaternionScene.setWorldFrameObjectVisibility(qScene.showWorldFrameObject);
                qSceneIdMap.set(qScene.originalId, quaternionScene.id().value());

                for (const trace of qScene.traces) {
                    let robotPartName = trace.robotPartName;
                    let parentSceneId = this.findNewSceneId(trace.parentSceneId, sceneIdMap);
                    if (parentSceneId === undefined) continue;

                    let robotId = this.findNewRobotId(trace.robotId, robotIdMap, parentSceneId);
                    if (robotId === undefined) continue;

                    this.addTracesToQuaternionScene(quaternionScene, parentSceneId, robotId, robotPartName);
                }
            }
        }

        // restore graph panels and their curves
        let graphIdMap: Map<string, string> = new Map(); // map the original id to the new id,    
        if(sessions.graphs !== undefined)
        {
            for(const graph of sessions.graphs)
            {
                let newGraph = new Graph(new Id().value(), graph.isDiff, graph.isTimeWarp);
                this.addGraph(newGraph);
                
                // console.log(graph.name);
                newGraph.setName(graph.name);
                graphIdMap.set(graph.originalId, newGraph.id());

                for(let i=0; i<graph.line_ids.length; i++)
                {
                    const [sceneOldId, contents] = this.decomposeLineId(graph.line_ids[i]);
                    let sceneNewId = this.findNewSceneId(sceneOldId, sceneIdMap);
                    graph.line_ids[i] = sceneNewId + "#" + contents;
                }

                newGraph.setCurrProperty(graph.currProperty);
                newGraph.setLineIds(graph.line_ids);
                newGraph.setAxisColor(graph.axisColor);
                newGraph.setBackgroundColor(graph.backgroundColor);
                newGraph.setLineWidth(graph.lineWidth);
                if(graph.filter !== undefined) newGraph.setFilter(graph.filter);
            }
        }

        // restore umap graph panels and their curves
        let umapGraphIdMap: Map<string, string> = new Map(); // map the original id to the new id,
        if(sessions.umapGraphs !== undefined)
        {
            for(const graph of sessions.umapGraphs)
            {
                let newUmapGraph = new UmapGraph(new Id().value());
                this.addUmapGraph(newUmapGraph);
                
                newUmapGraph.setName(graph.name);
                umapGraphIdMap.set(graph.originalId, newUmapGraph.id());

                for(let i=0; i<graph.line_ids.length; i++)
                {
                    const [sceneOldId, contents] = this.decomposeLineId(graph.line_ids[i]);
                    let sceneNewId = this.findNewSceneId(sceneOldId, sceneIdMap);
                    graph.line_ids[i] = sceneNewId + "#" + contents;
                }

                newUmapGraph.setLineIds(graph.line_ids);
                newUmapGraph.setAxisColor(graph.axisColor);
                newUmapGraph.setBackgroundColor(graph.backgroundColor);
                newUmapGraph.setLineWidth(graph.lineWidth);
            }
        }

        this.restoreWindows(sessions.layout, sceneIdMap, qSceneIdMap, graphIdMap, umapGraphIdMap);
        if(onRestoreLayout !== undefined)
            onRestoreLayout(sessions.layout);
    }

    /**
     * decompose the id of the drag button
     * to sceneId, robotName, partName
     * @param lineId
     * @returns 
     */
    decomposeLineId(lineId:string)
    {
        const [sceneId, contents] = lineId.split("#");
        return [sceneId, contents];
    }

    findNewSceneId(sceneOldId: string, sceneIdMap: Map<string, string>): string | undefined {
        return sceneIdMap.get(sceneOldId);
    }

    findNewRobotId(robotOldId: string, robotIdMap: Map<string, Map<string, string>>, parentSceneId: string) : string | undefined {
        return robotIdMap.get(parentSceneId)?.get(robotOldId);
    }

    findNewTraceId(traceOldId: string, traceIdMap: Map<string, string>) : string | undefined {
        return traceIdMap.get(traceOldId);
    }

    /**
     * go over every children (possibly grandchildren) of the layout
     * find robotScene and replace the old id with the new id
     * @param layout 
     * @param sceneIdMap 
     * @returns 
     */
    restoreWindows(layout: LayoutBase | undefined, sceneIdMap: Map<string, string>, qSceneIdMap: Map<string, string>, graphIdMap: Map<string, string>, umapGraphIdMap: Map<string, string>) {
        if(layout === undefined) return;
        let robotSceneIdParts = (id: string): [string, string, string] => {
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

        let renewId = (boxChildren: (BoxBase | PanelBase)[]): void =>{
            for (let i = 0; i < boxChildren.length; i++) {
                let panel = boxChildren[i] as PanelBase;
                let panelId = panel.activeId;

                // we need to make sure the activeId must be the same with its corresponding tab id
                // if the activeId cannot be find in the tab list, then it will always show the first tab
                // as the active tab
                let panelIdMap: Map<string, string> = new Map(); // store the tab/panel Id and its corresponding newId
                
                if (panelId !== undefined) {
                    if (panelId.startsWith("RobotScene")) {
                        // console.log(panelId);
                        let [, key, oldId] = robotSceneIdParts(panelId);
                        let newId = sceneIdMap.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = `RobotScene&${newID(4)}&${newId}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("QuaternionSpaceScene")) {
                        // console.log(panelId);
                        let [, oldId, type] = panelId.split("&");
                        let newId = qSceneIdMap.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = `QuaternionSpaceScene&${newId}&${newID(4)}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("Graph") || panelId.startsWith("DifferenceGraph")) {
                        let [prefix, oldId, type] = panelId.split("&");
                        let newId = graphIdMap.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = `${prefix}&${newId}&${newID(4)}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("UmapGraph")) {
                        let [prefix, oldId, type] = panelId.split("&");
                        let newId = umapGraphIdMap.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = `${prefix}&${newId}&${newID(4)}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("SceneLegend") || panelId.startsWith("LineGraphLegend")
                        || panelId.startsWith("QuaternionSpaceLegend") || panelId.startsWith("UmapLegend")) {
                        let [prefix, key, oldId] = panelId.split("&");
                        let map: Map<string, string>;
                        if (panelId.startsWith("SceneLegend"))
                            map = sceneIdMap;
                        else if (panelId.startsWith("LineGraphLegend"))
                            map = graphIdMap;
                        else if (panelId.startsWith("QuaternionSpaceLegend"))
                            map = qSceneIdMap;
                        else
                            map = umapGraphIdMap;
                        let newId = map.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = `${prefix}&${newID(4)}&${newId}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("TimeWarpTimeBar")) {
                        const oldId = panelId.substring("TimeWarpTimeBar".length);
                        let newId = sceneIdMap.get(oldId);
                        if (newId !== undefined) {
                            panel.activeId = "TimeWarpTimeBar" + newId;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                    else if (panelId.startsWith("TimeWarpedGraph")) {
                        let [prefix, oldGraphId, oldId, type] = panelId.split("&");
                        let newId = sceneIdMap.get(oldId);
                        let newGraphId = graphIdMap.get(oldGraphId);
                        if (newId !== undefined && newGraphId !== undefined) {
                            panel.activeId = `${prefix}&${newGraphId}&${newId}&${newID(4)}`;
                            panelIdMap.set(panelId, panel.activeId);
                        }
                    }
                }

                if (panel.tabs !== undefined) {
                    let tabs: TabBase[] = panel.tabs;
                    for (let j = 0; j < tabs.length; j++) {
                        let tab = tabs[j];
                        if (tab.id === undefined) continue;
                        if (panelIdMap.has(tab.id)) {
                            tab.id = panelIdMap.get(tab.id);
                            continue;
                        }
                        if (tab.id?.startsWith("RobotScene")) {
                            let [, key, oldId] = robotSceneIdParts(tab.id);
                            let newId = sceneIdMap.get(oldId);
                            if (newId !== undefined) {
                                tab.id = `RobotScene&${newID(4)}&${newId}`;
                            }
                        }
                        else if (tab.id?.startsWith("QuaternionSpaceScene")) {
                            let [, oldId, type] = tab.id.split("&");
                            let newId = qSceneIdMap.get(oldId);
                            if (newId !== undefined) {
                                tab.id = `QuaternionSpaceScene&${newId}&${newID(4)}`;
                            }
                        }
                        else if (tab.id?.startsWith("Graph") || tab.id?.startsWith("DifferenceGraph")) {
                            let [prefix, oldId, type] = tab.id.split("&");
                            let newId = graphIdMap.get(oldId);
                            if (newId !== undefined) {
                                tab.id = `${prefix}&${newId}&${newID(4)}`;
                            }
                        }
                        else if (tab.id?.startsWith("UmapGraph")) {
                            let [prefix, oldId, type] = tab.id.split("&");
                            let newId = umapGraphIdMap.get(oldId);
                            if (newId !== undefined) {
                                tab.id = `${prefix}&${newId}&${newID(4)}`;
                            }
                        }
                        else if (tab.id.startsWith("SceneLegend") || tab.id.startsWith("LineGraphLegend")
                            || tab.id.startsWith("QuaternionSpaceLegend") || tab.id.startsWith("UmapLegend")) {
                            let [prefix, key, oldId] = tab.id.split("&");
                            let map: Map<string, string>;
                            if (tab.id.startsWith("SceneLegend"))
                                map = sceneIdMap;
                            else if (tab.id.startsWith("LineGraphLegend"))
                                map = graphIdMap;
                            else if (tab.id.startsWith("QuaternionSpaceLegend"))
                                map = qSceneIdMap;
                            else
                                map = umapGraphIdMap;
                            let newId = map.get(oldId);
                            if (newId !== undefined) {
                                panel.activeId = `${prefix}&${newID(4)}&${newId}`;
                                panelIdMap.set(tab.id, panel.activeId);
                            }
                        }
                        else if (tab.id.startsWith("TimeWarpTimeBar")) {
                            const oldId = tab.id.substring("TimeWarpTimeBar".length);
                            let newId = sceneIdMap.get(oldId);
                            if (newId !== undefined) {
                                tab.id = "TimeWarpTimeBar" + newId
                            }
                        }
                        else if (tab.id.startsWith("TimeWarpedGraph")) {
                            let [prefix, oldGraphId, oldId, type] = tab.id.split("&");
                            let newId = sceneIdMap.get(oldId);
                            let newGraphId = graphIdMap.get(oldGraphId);
                            if (newId !== undefined && newGraphId !== undefined) {
                                tab.id = `${prefix}&${newGraphId}&${newId}&${newID(4)}`;
                            }
                        }
                    }
                }
                

                let box = boxChildren[i] as BoxBase;
                if(box.children !== undefined && box.children.length > 0)
                renewId(box.children);
            }
        }

        renewId(layout.dockbox.children);

        if (layout.floatbox?.children !== undefined) {
            renewId(layout.floatbox.children);
        }

        if (layout.maxbox?.children !== undefined) {
            renewId(layout.maxbox.children);
        }
        
        if (layout.windowbox?.children !== undefined) {
            renewId(layout.windowbox.children);
        }
    }

    addTracesToQuaternionScene(quaternionScene: QuaternionSpaceScene, parentSceneId: string, robotId: string, robotPartName: string)
    {
        let parentRobotScene = this.robotSceneById(parentSceneId);
        if (parentRobotScene === undefined) return;

        let robot = parentRobotScene.robotById(robotId);
        if(robot === undefined) return;
        let robotPart: RobotLink | RobotJoint | undefined = robot.jointMap().get(robotPartName);
        if (robotPart === undefined) {
            robotPart = robot.linkMap().get(robotPartName);
        }

        quaternionScene.addChildTrace(
            parentRobotScene,
            robot,
            RobotScene.frameRange(this.startTime(), this.endTime()),
            robotPart
        );
    }

    addTracesToRobotScene(currSceneId: string, parentSceneId: string, robotId: string, robotPartName: string, traceIdMap: Map<string, string>, originalId: string)
    {
        let parentRobotScene = this.robotSceneById(parentSceneId);
        if (parentRobotScene === undefined) return;
        let currScene = this.robotSceneById(currSceneId);
        if (currScene === undefined) return;

        let robot = parentRobotScene.robotById(robotId);
        if(robot === undefined) return;
        let robotPart: RobotLink | RobotJoint | undefined = robot.jointMap().get(robotPartName);
        if (robotPart === undefined) {
            robotPart = robot.linkMap().get(robotPartName);
        }
        if (currScene === parentRobotScene) { // add a child trace
            if (currScene.hasChildTrace(robot, robotPart)) {
            //   currScene.removeChildTrace(robot, robotPart);
            } else {
                let traces = currScene.addChildTrace(
                    robot,
                    RobotScene.frameRange(this.startTime(), this.endTime()),
                    robotPart
                );
                traceIdMap.set(originalId, traces[0]);
            }
          }
          else // add a ghost trace
          {
            if (currScene.hasReceivedGhostTrace(robot, robotPart))
            {
                //   droppedScene.removeGhostTracesFrom(robot, robotPart, currScene);
            }
            else {
              // Add a trace from the given robotscene and robot to the current scene
              let traces = parentRobotScene.sendGhostTracesTo(
                robot,
                RobotScene.frameRange(this.startTime(),this.endTime()),
                robotPart,
                currScene
              );
              traceIdMap.set(originalId, traces[0]);
            }
            
          }
    }
}