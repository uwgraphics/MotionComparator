import { Animation } from '../Animation';
import { AnimationGroup } from '../AnimationGroup';
import { AnimationManager, serialized_animation_manager } from '../AnimationManager';
import { AnimationTable, serialized_animation_table } from '../AnimationTable';
import { APP, MAX_FRAMERATE } from '../constants';
import { enumerate, randColor, clamp, countUsing, onlyUniquesUsing as onlyUniquesBy, zip } from '../helpers';
import { Id } from '../Id';
import { loadJsonFromLocalFile, loadJsonFromURL } from '../load_functions';
import { Robot, serialized_robot } from '../objects3D/Robot';
import { RobotJoint } from '../objects3D/RobotJoint';
import { RobotLink } from '../objects3D/RobotLink';
import { RobotSceneManager } from '../RobotSceneManager';
import { saveToJson } from '../save_functions';
import { Trace } from '../objects3D/Trace';
import { serialized_three_scene, ThreeScene } from "./ThreeScene";
import assert, { AssertionError } from 'assert';
import T from '../true_three';
import { MaybeDestroyed } from '../maybe_destroyed/MaybeDestroyed';
import { MaybeDestroyedArray } from '../maybe_destroyed/MaybeDestroyedArray';
import { SubscribeArrayWithArg } from '../subscriptable/SubscribeArrayWithArg';
import { SubscriptableValue } from '../subscriptable/SubscriptableValue';
import { DynamicTimeWarp } from '../DynamicTimeWarping';
import { Arrow } from '../objects3D/Arrow';
import * as d3 from 'd3'; 
import { Material, Vector3 } from 'three';
import { PopupHelpPage } from '../react_components/popup_help_page';

export type TimeWarpFunc = (baseTime: number) => number;

export interface camera_info {
    lookFrom: T.Vector3;
    lookAt:   T.Vector3;
}

export interface serialized_robot_scene extends serialized_three_scene {
    id: string,
    robots: serialized_robot[],
    animationManager: serialized_animation_manager,
    animationTables: serialized_animation_table[],
}

export interface old_serialized_robot_scene {
    animationMap: number[],
    animationURLs: string[],
    bookmarks: {
        robotName: string,
        bookmarks: {
            name: string,
            bookmarks?: [],
            cameraMarks?: [],
        }[],
    }[],
    cameraViews: [],
    configs: number[],
    configsMap: number[],
    generalSettings: {
        camera: {
            cameraPos: {
                x:number,
                y:number,
                z:number,
            },
            cameraLookAt: {
                x:number,
                y:number,
                z:number,
            },
            cameraZoom: number,
        },
        clickSelect: boolean,
        selectedRobot: string,
        tabStates: {
            top: boolean,
            bottom: boolean,
            left: boolean,
            right: boolean,
        }
    },
    linesData: [],
    robotFiles: string[], // URLs to robots
    robotSettings: [boolean, boolean, string, boolean, string][],
    viewOnly: boolean,
}

export interface joint_configs {

}

export type RobotFrameData = {
    times: number[],
    positions: Map<undefined | RobotJoint | RobotLink, T.Vector3[]>,
    jointAngles: Map<RobotJoint, number[]>
    rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]>,
}

export type FrameData = Map<Robot, RobotFrameData>;

/**
 * An object capable of warping time from a base scene to a target scene i.e.
 * each time in the base scene's time scale is mapped to a time in the target
 * scene's time scale. The mapping may be 1:1, linear, or some other function.
 * 
 * WARNING: while `untimeWarp` is meant to simply be the opposite of `timeWarp`,
 * they may both return approximations. This means that calling them successively
 * to timeWarp and then untimeWarp a value over and over again may walk the value
 * in a direction i.e. make it successively more negative and/or positive rather
 * than keeping it around some consistent value.
 */
export interface TimeWarpObj {
    /**
     * @returns The given time in the base RobotScene's time scale converted to
     * the corresponding time in the target RobotScene's time scale.
     */
    timeWarp(baseTime: number): number;
    /**
     * @returns The given time in the target RobotScene's time scale converted
     * to the corresponding time in the base RobotScene's time scale.
     */
    untimeWarp(targetTime: number): number;
    /**
     * @returns A pair of parrallel arrays used to map times in the base scene
     * to times in the target scene (i.e. returns [baseSceneTimes,
     * targetSceneTimes]). Retruns undefined if the data is kept in a different
     * format.
     */
    timeWarpMap(): readonly [readonly number[], readonly number[]];

    indexMap(): [ReadonlyArray<number>, ReadonlyArray<number>];
}

//const palettes =  d3.schemeSet1;
const palettes = ["rgb(255, 255, 0)", "brown", /*"white",*/ "red", "#204BD8",  "purple", "green"];
export type world_frames = "ROS" | "THREE.js";
export type camera_type = "Perspective" | "Orthographic";
/**
 * An encapsulation of a ThreeScene that specifically should be used for holding
 * Robots and their Animations.
 */
export class RobotScene extends ThreeScene {
    protected _id: Id;
    protected _robots: Robot[];    // Robot object (misnomer as any object loaded from a URDF can be put into a Robot object)

    protected _ghostRobots: Map<string, Robot>; // the ghost robots that are displayed in this scene


    // --------
    // Robot Interface
    protected _selectedRobot: Robot | undefined; // currently selected robot
    protected _hoveredRobot: Robot | undefined; // currently hovored-over robot

    // Traces that are owned by this scene.
    protected _traces: Trace[];

    protected _sentGhostTraces: MaybeDestroyedArray<Trace>; // Traces this RobotScene has sent to other RobotScenes
    protected _receivedGhostTraces: MaybeDestroyedArray<Trace>; // Traces this RobotScene has been given by outside sources and thus does not own


    protected _traceMap: Map<string, Trace>;

    protected _robotSceneManager: SubscriptableValue<RobotSceneManager | undefined>;

    protected _color: string;

    protected _colorPalettes: string[]; // the colors of the traces

    protected _arrows: Map<string, Arrow>;
    protected _traceFrom: Trace | undefined;

    // the density and axis size of the traces that will be shown in this scene
    protected _density: number;
    protected _axisSize: number;

    protected _traceSize: number;

    protected _update: boolean; // whether traces are added or removed

    // undefined when there is no TimeWarp, a valid object otherwise.
    protected _timeWarpObj: undefined | TimeWarpObj;

    protected _baseSceneId: string;
    protected _keyObjects: string[];
    protected _currTimeWarpBase: RobotScene | undefined

    protected _num_ee_targets: number;

    protected _backgroundColor: string;
    protected _directionalLightIntensity: number;
    protected _directionalLight: T.DirectionalLight; 
    protected _ambientLightIntensity: number;
    protected _ambientLight: T.AmbientLight;
    protected _groundPlane: T.Object3D;
    protected _groundGrid: T.GridHelper;
    protected _cameraType: camera_type;
    protected _toggleCamera: boolean;
    protected _worldFrame: world_frames;
    protected _toggleWorldFrame: boolean;
    protected _groundPlaneColor: string;
    protected _groundPlaneOpacity: number;

    protected _worldFrameObject: T.Object3D; // the actual world frame object

    constructor(parentRobotSceneManager?: RobotSceneManager, id?:string) {
        super();
        this._id = new Id(id);
        this._color = randColor();

        this._robotSceneManager = new SubscriptableValue(parentRobotSceneManager);

        this._colorPalettes = [...palettes];

        this._arrows = new Map();

        this._density = 1/2;
        this._axisSize = 0;

        this._traceSize = 1;

        this._update = false;

        this._traceMap = new Map();

        // --------
        // Robot Interface
        this._robots = [];
        this._ghostRobots = new Map();

        this._traces = [];
        this._sentGhostTraces = new MaybeDestroyedArray();
        this._receivedGhostTraces = new MaybeDestroyedArray();

        this._baseSceneId = "";
        this._keyObjects = [];

        this._worldFrameObject = new T.Object3D();
        this.addWorldFrame();

        this._num_ee_targets = 0;

        // this._backgroundColor = "#263238"; // default background color of the scene 
        
        this._backgroundColor = "#171718";
        this._directionalLightIntensity = 1.0;
        this._ambientLightIntensity = 0.2;
        this._directionalLight = new T.DirectionalLight();
        this._ambientLight = new T.AmbientLight();
        this._groundPlane = new T.Object3D();
        this._groundGrid = new T.GridHelper(100, 100, 0x000000, 0x000000);
        this._cameraType = "Perspective";
        this._toggleCamera = false;
        this._worldFrame = "ROS";
        this._toggleWorldFrame = false;
        this._groundPlaneColor = "#343536";
        this._groundPlaneOpacity = 0.2;
        // --------
        // callbacks
    }

    ghostRobots(): Robot[]{
        let ghostRobots: Robot[] = [];
        for(const [, robot] of this._ghostRobots)
            ghostRobots.push(robot);
        return ghostRobots;
    }
    getGhostRobot(ghostRobotId: string): Robot | undefined{
        return this._ghostRobots.get(ghostRobotId);
    }
    hasGhostRobt(ghostRobotId: string): boolean{
        return this._ghostRobots.has(ghostRobotId);
    }
    addGhostRobot(ghostRobot: Robot){
        this._ghostRobots.set(ghostRobot.idValue(), ghostRobot);
    }
    removeGhostRobot(ghostRobotId: string){
        let ghostRobot =  this._ghostRobots.get(ghostRobotId);
        ghostRobot?.removeControlledClone(this);
        this._ghostRobots.delete(ghostRobotId);
        APP.updateUI();
    }

    backgroundColor(): string
    {
        return this._backgroundColor;
    }
    setBackgroundColor(newColor: string)
    {
        this._backgroundColor = newColor;
        this.scene().background = new T.Color(newColor);
        this.render();
    }

    setCameraType(cameraType: camera_type)
    {
        this._cameraType = cameraType;
        this._toggleCamera = true;
    }
    toggleCameraType()
    {
        if(this._cameraType === "Perspective")
            this._cameraType = "Orthographic";
        else
            this._cameraType = "Perspective"
        this._toggleCamera = true;
    }
    cameraType(): camera_type
    {
        return this._cameraType;
    }
    finishToggleCamera()
    {
        this._toggleCamera = false;
    }
    isToggleCamera(): boolean
    {
        return this._toggleCamera;
    }
    
    setWorldFrame(worldFrame: world_frames)
    {
        this._worldFrame = worldFrame;
        this._toggleWorldFrame = true;
    }
    toggleWorldFrame()
    {
        if(this._worldFrame === "ROS")
            this._worldFrame = "THREE.js";
        else
            this._worldFrame = "ROS"
        this._toggleWorldFrame = true;
    }
    worldFrame(): world_frames
    {
        return this._worldFrame;
    }
    finishToggleWorldFrame()
    {
        this._toggleWorldFrame = false;
    }
    isToggleWorldFrame(): boolean
    {
        return this._toggleWorldFrame;
    }

    // ----------
    // helper functions to control the color of the ground plane
    groundPlaneColor(): string{
        return this._groundPlaneColor;
    }

    setGroundPlaneColor(color: string){
        this._groundPlaneColor = color;
        if (this._groundPlane instanceof T.Mesh) {
            const mesh = this._groundPlane as T.Mesh;
            const material = mesh.material as T.MeshStandardMaterial;
            material.color = new T.Color(color);
            this.render();
        }
    }

    // ----------
    // helper functions to control the opacity of the ground plane
    groundPlaneOpacity(): number{
        return this._groundPlaneOpacity;
    }

    setGroundPlaneOpacity(opacity: number){
        this._groundPlaneOpacity = opacity;
        if (this._groundPlane instanceof T.Mesh) {
            const mesh = this._groundPlane as T.Mesh;
            const material = mesh.material as T.MeshStandardMaterial;
            material.opacity = opacity;
            this.render();
        }
    }

    // ----------
    // helper functions to control whether or not to show the ground plane
    isGroundPlaneVisible(): boolean
    {
        return this._groundPlane.visible;
    }
    setGroundPlaneVisibility(visible: boolean)
    {
        this._groundPlane.visible = visible;
        this._groundGrid.visible = visible;
        this.render();
    }
    // initialize ground plane
    setGroundPlane(groundPlane: T.Object3D, groundGrid: T.GridHelper)
    {
        this._groundPlane = groundPlane;
        this._groundGrid = groundGrid;
    }

    // ----------
    // helper functions to control whether or not to show the world frame
    isWorldFrameObjectVisible(): boolean
    {
        return this._worldFrameObject.visible;
    }
    setWorldFrameObjectVisibility(visible: boolean)
    {
        this._worldFrameObject.visible = visible;
        this.render();
    }

    // ----------
    // helper functions to control the intensity of the light of this robot scene
    directionalLightIntensity(): number
    {
        return this._directionalLightIntensity;
    }
    setDirectionalLightIntensity(intensity: number)
    {
        this._directionalLight.intensity = intensity;
        this._directionalLightIntensity = intensity;
        this.render();
    }
    directionalLight(): T.DirectionalLight
    {
        return this._directionalLight;
    }
    // initialize directional light
    setDirectionalLight(directionalLight: T.DirectionalLight)
    {
        this._directionalLight = directionalLight;
    }
    ambientLightIntensity(): number
    {
        return this._ambientLightIntensity;
    }
    setAmbientLightIntensity(intensity: number)
    {
        this._ambientLight.intensity = intensity;
        this._ambientLightIntensity = intensity;
        this.render();
    }
    ambientLight(): T.AmbientLight
    {
        return this._ambientLight;
    }
    // initialize ambient light
    setAmbientLight(ambientLight: T.AmbientLight)
    {
        this._ambientLight = ambientLight;
    }


    setTraceFrom(traceFrom: Trace)
    {
        this._traceFrom = traceFrom;
    }

    setTraceTo(traceTo: Trace)
    {
        if(this._traceFrom !== undefined)
        {
            let arrow = new Arrow(this._traceFrom, traceTo, this, this.getNextColor());
            this._arrows.set(arrow.id(), arrow);
            this._traceFrom = undefined;
            this._update = true;
        }
    }

    /**
     * this function is mainly used to restore the arrows in a this scene
     * @param traceFromId 
     * @param traceToId 
     * @returns 
     */
    addArrow(traceFromId: string, traceToId: string){
        let traceFrom = this._traceMap.get(traceFromId);
        let traceTo = this._traceMap.get(traceToId);
        if(traceFrom === undefined || traceTo === undefined) return;
        let arrow = new Arrow(traceFrom, traceTo, this, this.getNextColor());
        this._arrows.set(arrow.id(), arrow);
    }

    removeArrow(arrowId: string)
    {
        let arrow = this._arrows.get(arrowId);
        if(arrow !== undefined)
        {
            this._arrows.delete(arrowId);
            arrow.setParentScene(undefined);
            this._update = true;
            this.addColorBack(arrow.color());
        }
    }

    getAllArrows(): Arrow[]
    {
        let arrows: Arrow[] = [];
        for(const [, arrow] of this._arrows)
            arrows.push(arrow);
        return arrows;
    }

    density(): number{
        return this._density;
    }

    setDensity(density: number){
        this._density = density;
        let traces = this.getAllTraces();
        for(const trace of traces)
            trace.setDensity(density);
        this.render();
    }

    axisSize(): number{
        return this._axisSize;
    }

    setAxisSize(axisSize: number)
    {
        this._axisSize = axisSize;
        let traces = this.getAllTraces();
        for(const trace of traces)
            trace.setAxisSize(axisSize);
        this.render();
    }

    traceSize(): number{
        return this._traceSize;
    }

    setTraceSize(traceSize: number)
    {
        this._traceSize = traceSize;
        let traces = this.getAllTraces();
        for(const trace of traces)
            trace.setTraceSize(traceSize);
        this.render();
    }

    /**
     * Sets the parent of this RobotScene.
     * 
     * Note: This function assumes that it is called by the RobotSceneManager that it is
     * being set to and thus that the parent RobotSceneManager has or will do the steps
     * necessary to add this RobotScene to itself.
     * 
     * @param newManager The new RobotSceneManager. Note that if this is undefined, then
     * this RobotScene empties itself because it assumes that it is being deleted.
     */
    setParentRobotSceneManager(newManager?: RobotSceneManager) {
        if (newManager === this._robotSceneManager.value()) { return; }

        this._robotSceneManager.setValue(
            null,
            newManager,
            () => {
                if (newManager === undefined) {
                    for (const robot of this._robots) {
                        this.removeChildRobot(robot);
                    }

                    // This scene owns these ghost traces so should destroy them before it is deleted.
                    this._sentGhostTraces.destroyContents();
                }
            }
        )
        APP.updateUI();
    }

    /**
     * @returns The parent RobotSceneManager of this RobotScene.
     */
    robotSceneManager(): undefined | RobotSceneManager {
        return this._robotSceneManager.value();
    }

    /**
     * @returns The subscription for right before this RobotScene's parent RobotSceneManager is set.
     */
    beforeParentRobotSceneManagerSet(): SubscribeArrayWithArg<[undefined | RobotSceneManager, undefined | RobotSceneManager]> {
        return this._robotSceneManager.beforeSet();
    }

    /**
     * @returns The subscription for right before this RobotScene's parent RobotSceneManager is set.
     */
    afterParentRobotSceneManagerSet(): SubscribeArrayWithArg<[undefined | RobotSceneManager, undefined | RobotSceneManager]> {
        return this._robotSceneManager.afterSet();
    }

    /**
     * Returns a Robot only if this RobotScene has a unique Robot by the given name.
     * 
     * Note: "Unique" here simply means that there are no two Robots with
     * the given name. If there are, then undefined is returned.
     * @param robotName The name of the unique Robot with a joint with the given name.
     * @returns The found Robot or undefined if more than one Robot with the given
     * robotName is found.
     */
    getRobotByName(robotName: string): undefined | Robot {
        let robotsWithName = this.robots().filter((r) => r.name() === robotName);
        if (robotsWithName.length === 1) {
            return robotsWithName[0];
        }
        return;
    }

    /**
     * Returns a RobotJoint only if this RobotScene has a unique Robot by the given name
     * and if the unique Robot has a unique Joint with the given joint name.
     * 
     * Note: "Unique" here simply means that there are no two Robots/Joints with
     * the given name. If there are, then undefined is returned.
     * @param robotName The name of the unique Robot with a joint with the given name.
     * @param jointName The name of a unique Joint for the given unique Robot.
     * @returns The found RobotJoint or undefined if more than one Robot/Joint with the given
     * robotName/jointName is found.
     */
    getJointByName(robotName: string, jointName: string): undefined | RobotJoint {
        let robot = this.getRobotByName(robotName);
        if (robot !== undefined) {
            let joints = robot.joints().filter((j) => j.name() === jointName);
            if (joints.length === 1) {
                return joints[0];
            }
        }
        return;
    }

    /**
     * Returns a RobotLink only if this RobotScene has a unique Robot by the given name
     * and if the unique Robot has a unique Link with the given link name.
     * 
     * Note: "Unique" here simply means that there are no two Robots/Links with
     * the given name. If there are, then undefined is returned.
     * @param robotName The name of the unique Robot with a link with the given name.
     * @param linkName The name of a unique Link for the given unique Robot.
     * @returns The found RobotLink or undefined if more than one Robot/Link with the given
     * robotName/linkName is found.
     */
    getLinkByName(robotName: string, linkName: string): undefined | RobotLink {
        let robot = this.getRobotByName(robotName);
        if (robot !== undefined) {
            let links = robot.links().filter((l) => l.name() === linkName);
            if (links.length === 1) {
                return links[0];
            }
        }
        return;
    }

    getAllTraces(): Trace[]
    {
        let result: Trace[] = [...this._traces];
        let array = Array.from(this._receivedGhostTraces.aliveContents());
        for(let i=0; i<array.length; i++)
            result.push(array[i][0]);
        return result;
    }
    /**
     * Returns true if a ghost of the trace for the given part of the given
     * robot is in this scene and false otherwise.
     * @param robot Robot who owns the ghost trace that was put in this
     * RobotScene (the ghost of the trace was put into the scene, this is the
     * robot that the trace is of).
     * @param robotPart The part of the `robot` that you are asking if is traced.
     * @returns true if the given part of the given `robot` is traced and false
     * otherwise.
     */
    hasReceivedGhostTrace(robot:Robot, robotPart: undefined | RobotJoint | RobotLink): boolean {
        for (const trace of this._receivedGhostTraces) {
            if (trace.robot() === robot && trace.robotPart() === robotPart) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns any received ghost traces from the given robot and robotPart.
     * @param robot The Robot the trace would be for.
     * @param robotPart The part of the Robot the trace would be for.
     * @returns The ghost traces if found.
     */
    getReceivedGhostTraces(robot:Robot, robotPart: undefined | undefined | RobotJoint | RobotLink): [Trace, MaybeDestroyed<Trace>][] {
        if (robotPart === undefined) {
            return Array.from(this._receivedGhostTraces.aliveContents()).filter(([t,]) => t.robot() === robot);
        } else {
            return Array.from(this._receivedGhostTraces.aliveContents()).filter(([t,]) => t.robot() === robot && t.robotPart() === robotPart);
        }
    }

    sendGhostTracesTo(robot:Robot, times: number[], robotPart: undefined | undefined | RobotJoint | RobotLink, otherScene: RobotScene): string[] {
        // Remove any previous versions of these traces
        this.removeGhostTracesFrom(robot, robotPart, otherScene);

        let traceIds: string[] = [];
        for (const trace of RobotScene.newTraces(robot, times, robotPart, otherScene.getNextColor(), otherScene._axisSize, otherScene._density, otherScene._traceSize)) {
            // create the ghost trace
            trace.setOpacity(0.1);
            // trace.setColor(otherScene._colorPalettes.pop());
            let mTrace = new MaybeDestroyed(trace);
            mTrace.afterDestroyed().subscribe(() => {
                trace.setParentScene(undefined);
                return false;
            })

            // Give ghost trace to the other scene
            this._sentGhostTraces.push(mTrace);
            otherScene.receiveGhostTrace(mTrace);
            traceIds.push(trace.id());
        }

        if(robotPart !== undefined)
            robotPart.addToScene();
        else
            robot.addToScene();
        APP.render();
        APP.updateUI();
        return traceIds;
    }

    protected receiveGhostTrace(ghostTrace: MaybeDestroyed<Trace>) {
        let trace = ghostTrace.deref();
        if (trace) {
            this._update = true;
            this._receivedGhostTraces.push(ghostTrace);
            trace.setParentScene(this);
            this._traceMap.set(trace.id(), trace);
        }
    }

    /**
     * The given robot exists in the given scene. There, it can be traced. The
     * ghost of that trace is removed from this scene.
     * @param otherScene The scene to remove the ghost traces from.
     * @param robot The robot that exists in the given scene and whose trace has been put into this scene as a ghost.
     */
    removeGhostTracesFrom(robot:Robot, robotPart: undefined | undefined | RobotJoint | RobotLink, otherScene: RobotScene): boolean {
        let d = false;
        for (const [, maybeGhostTrace] of otherScene.getReceivedGhostTraces(robot, robotPart)) {
            // A ghost trace can only be in one scene at a time so we can just destroy it to remove it.
            let trace = maybeGhostTrace.deref();
            if (trace) {
                otherScene._traceMap.delete(trace.id());
                otherScene.addColorBack(trace.color());
                otherScene._update = true;
            }
            maybeGhostTrace.destroy();
            d = true;
        }
        console.log("remove ghost trace");
        if(robotPart !== undefined)
            robotPart.removeFromScene();
        else
            robot.removeFromScene();
        APP.render();
        APP.updateUI();
        return d;
    }

    /**
     * @param id The ID of the robot to look for.
     * @returns The Robot with the given id or undefined if it was not found in this Scene.
     */
    robotById(id: string): Robot | undefined {
        for (const robot of this._robots) {
            if (robot.idValue() === id) {
                return robot;
            }
        }
    }

    /**
     * @returns A TimeWarpObj if this RobotScene is a target scene or undefined
     * if it's time is not warped.
     */
    timeWarping(): undefined | TimeWarpObj {
        return this._timeWarpObj;
    }

    /**
     * 
     * @returns true if the current scene is time warped
     */
    isTimeWarping(): boolean{
        return this._timeWarpObj !== undefined;
    }

    /**
     * @param timeWarp The new time warp function. If undefined, then the
     * timewarp function is a 1:1 time warp (i.e. no time warping).
     */
    setTimeWarping(timeWarp?: TimeWarpObj) {
        this._timeWarpObj = timeWarp;
    }

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
            // for (const anyScene of this.allManagedRobotScenes()) {
            //     anyScene.setTimeWarping(undefined);
            // }
            this.setTimeWarping(undefined);
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

        const robotSceneManager = this._robotSceneManager.value();
        if(robotSceneManager === undefined)
        {
            setNoTimeWarpBaseBeforeReturn();
            return;
        }

        assert(
            robotSceneManager.hasManagedRobotScene(baseScene),
            `You can not set the RobotSceneManager to use a scene that it does not own `
            + `as its timewarp base. Scene: ${baseScene}`
        );

        // --- Get the base's frame data

        // Get the frame bounds for the base scene

        const sampleRate = MAX_FRAMERATE / 2; // frames per second
        const startTime = robotSceneManager.startTime();
        const endTime = robotSceneManager.endTime();
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

        // Ignore (base -> base) combination (will always be a 1:1 timewarp i.e. no time warp)
        if (this === baseScene) { return; }

        let otherSceneFrameData: FrameData;
        {
            // Get frame data for only the robots and joints whose names appear
            // once in their respective lists
            let uniqueRobots = new Set(onlyUniquesBy(this.robots(), (r) => r.name()));
            otherSceneFrameData = this.frameData(times,
                (r) => r.includePosInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r),
                (r, l) => l.includePosInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.links(), l, (l) => l.name()) === 1),
                (r, j) => j.includePosInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.joints(), j, (j) => j.name()) === 1),
                (r, j) => j.includeAngleInTimeWarpConsideration() && baseRobotFrameDataByRobotName.has(r.name()) && uniqueRobots.has(r) && (countUsing(r.articuatedJoints(), j, (j) => j.name()) === 1),
            );

            // If the comparison data for this scene is empty then there is
            // nothing to compare with the base scene so just continue to the
            // next scene.
            if (otherSceneFrameData.keys().next().done === true) {
                return;
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

        this.setTimeWarping(timeWarpObj);

        this._currTimeWarpBase = baseScene;
        APP.updateUI();
        APP.render();
    }

    baseSceneId(): string
    {
        if(this._currTimeWarpBase === undefined) return " ";
        return this._currTimeWarpBase?.id().value();
    }

    setKeyObjects(keyObjects: string[])
    {
        this._keyObjects = [...keyObjects];
    }

    keyObjects(): string[]
    {
        return this._keyObjects;
    }

    /**
     * Returns an array containing all the times specified by the given parameters.
     * @param startTime The start time (in seconds and relative to the full time
     * of the animation) that you want to start the trace at.
     * @param endTime The end time (in seconds and relative to the full time of
     * the animation) that you want to start the trace at.
     * @param sampleRate How many samples per second you want the trace to use.
     * @param maxSamples The maximum number of samples total to use. If using the
     * number of samples per second yeilds a larger number of samples than
     * `maxSamples`, then `maxSamples` are gotten evenly over the time frame and
     * used to generate the trace.
     * @param timeWarp The timewarp function to use when generating the
     * positions. If the given function is `undefined`, then no timewarping
     * is done. Use `undefined` when you want no time warping and
     * `this.timeWarp` when you want the default time warp.
     * @returns An array containing the specified range of values.
     */
    static frameRange(startTime: number, endTime: number, sampleRate: number = MAX_FRAMERATE / 2, maxSamples: number = MAX_FRAMERATE * 10, timeWarp?: (baseTime: number) => number): number[] {
        if (timeWarp === undefined) {
            // define it as a "no time warp" function
            timeWarp = (baseTime: number) => baseTime;
        }

        sampleRate = Math.abs(sampleRate);
        maxSamples = Math.abs(maxSamples);

        let timeLen = Math.abs(endTime - startTime);
        let totalSamples = Math.min(Math.floor(sampleRate * timeLen), maxSamples);
        let step = Math.abs(timeLen / totalSamples);

        let timeGen;

        if ((isNaN(step)) || ((timeLen / step) < 2)) {
            timeGen = function* () {
                for (let time of [startTime - 0.001, startTime, startTime + 0.001]) {
                    yield time;
                }
            }
        } else {
            timeGen = function* () {
                for (let time = startTime; time <= endTime; time += step) {
                    yield time;
                }
            }
        }

        let out: number[] = [];
        const _timeWarp = timeWarp as TimeWarpFunc;
        for (const baseTime of timeGen()) {
            out.push(_timeWarp(baseTime));
        }
        return out;
    }

    /**
     * Gets all the frame data at the given times with the given filters.
     * 
     * If any filter function is not included, then it is assumed to return
     * `true` for all values passed to it.
     * @param times The times that the frames should correspond to.
     * @param linkPosFilter When returns true, the RobotLink's position is included.
     * @param jointPosFilter When returns true, the RobotJoint's position is included.
     * @param jointAngleFilter When returns true, the RobotJoint's angle is included.
     * @param worldOrLocal When true, the positions are in world coordinates. 
     * When false, the positions are in the robot's local coordinates.
     * @returns The filtered frame data.
     */
    frameData(
            times: readonly number[],
            robotPosFilter?: (robot: Robot) => boolean,
            linkPosFilter?: (robot: Robot, link: RobotLink) => boolean,
            jointPosFilter?: (robot: Robot, joint: RobotJoint) => boolean,
            jointAngleFilter?: (robot: Robot, joint: RobotJoint) => boolean,
            robotRotFilter?: (robot: Robot) => boolean,
            linkRotFilter?: (robot: Robot, link: RobotLink) => boolean,
            jointRotFilter?: (robot: Robot, joint: RobotJoint) => boolean,
            worldOrLocal: boolean = true
    ): FrameData {
        let origTime = this._animationManager.time();

        let _robotPosFilter    = robotPosFilter    ?? (() => true);
        let _linkPosFilter = linkPosFilter ?? (() => true);
        let _jointAngleFilter  = jointAngleFilter  ?? (() => true);
        let _jointPosFilter    = jointPosFilter    ?? (() => true);
        let _robotRotFilter    = robotRotFilter    ?? (() => false);
        let _linkRotFilter    = linkRotFilter    ?? (() => false);
        let _jointRotFilter    = jointRotFilter    ?? (() => false);

        // Basically, filter and categorize things now, then get the data,
        // then reorganize the data into the output format.

        let posRobots:    [T.Vector3[], Robot][] = [];
        let posLinks:  [T.Vector3[], Robot, RobotLink][] = [];
        let posJoints:    [T.Vector3[], Robot, RobotJoint][] = [];
        let angleJoints:  [number[],    Robot, RobotJoint][] = [];
        let rotRobot: [T.Quaternion[], Robot][] = [];
        let rotLinks: [T.Quaternion[], Robot, RobotLink][] = [];
        let rotJoints:    [T.Quaternion[], Robot, RobotJoint][] = [];

        for (const robot of this.robots()) {
            if (_robotPosFilter(robot)) { posRobots.push([[], robot]); }

            for (const joint of robot.joints()) {
                if (_jointPosFilter(robot, joint)) { posJoints.push([[], robot, joint]) }
            }

            for (const joint of robot.articuatedJoints()) {
                if (_jointAngleFilter(robot, joint)) { angleJoints.push([[], robot, joint]); }
            }

            for (const link of robot.links()) {
                if (_linkPosFilter(robot, link)) { posLinks.push([[], robot, link]); }
            }

            if (_robotRotFilter(robot)) { rotRobot.push([[], robot]); }

            for (const link of robot.links()) {
                if (_linkRotFilter(robot, link)) { rotLinks.push([[], robot, link]); }
            }

            for (const joint of robot.joints()) {
                if (_jointRotFilter(robot, joint)) { rotJoints.push([[], robot, joint]) }
            }
        }

        // If everything was filtered out, don't do anything more because
        // animationManager.setTime is expensive when it's for nothing.
        if (posRobots.length === 0 && posLinks.length === 0 && posJoints.length === 0 && angleJoints.length === 0 && rotRobot.length === 0 && rotLinks.length === 0 && rotJoints.length === 0) {
            return new Map();
        }

        // Get the frame data.
        // General idea is to set the time on the animation manager which makes
        // the animation manager set the positions of every Robot in this Scene
        // for the animations. Then, steal the positions/angles from the now-moved
        // animation objects.

        if (worldOrLocal) {
            for (const time of times) {
                this._animationManager.setTime(time);

                for (const [l, robot] of posRobots)    { l.push(robot.getWorldPosition()); }
                for (const [l,, link] of posLinks) { l.push(link.getWorldPosition()); }
                for (const [l,, joint] of posJoints)    { l.push(joint.getWorldPosition()) }
                for (const [l,, joint] of angleJoints)  { l.push(joint.angle()) }
                for (const [l, robot] of rotRobot)    { l.push(robot.getWorldQuaternion()); }
                for (const [l,, link] of rotLinks) { l.push(link.getWorldQuaternion()); }
                for (const [l,, joint] of rotJoints)    { l.push(joint.getWorldQuaternion());}
            }
        } else {
            throw new Error("Not implemented yet");
        }

        this._animationManager.setTime(origTime);

        // Reorganize the data into the return format

        let out: FrameData = new Map();

        /**
         * Assures that there is a frame holder in the `frames` Map for the
         * given Robot, creating one if necessary. Returns the existing or
         * created frame holder.
         */
        let assureRobotFrame = (robot: Robot): RobotFrameData => {
            let frames = out.get(robot);
            if (frames === undefined) {
                let fs = {
                    times,
                    positions: new Map(),
                    jointAngles: new Map(),
                    rotations: new Map(),
                };
                out.set(robot, fs as any);
                return fs as any;
            }
            return frames;
        }

        for (const [l, robot] of posRobots) { 
            assureRobotFrame(robot).positions.set(undefined, l); }
        for (const [l, robot, link] of posLinks) {
            assureRobotFrame(robot).positions.set(link, l); }
        for (const [l, robot, joint] of posJoints)  {
            assureRobotFrame(robot).positions.set(joint, l) }
        for (const [l, robot, joint] of angleJoints)  {
            assureRobotFrame(robot).jointAngles.set(joint, l) }
        for (const [l, robot] of rotRobot) { 
            assureRobotFrame(robot).rotations.set(undefined, l); }
        for (const [l, robot, link] of rotLinks) {
            assureRobotFrame(robot).rotations.set(link, l); }
        for (const [l, robot, joint] of rotJoints)  {
            assureRobotFrame(robot).rotations.set(joint, l) }


        return out;
    }

    /**
     * Returns the animation_frames for the given robot of the given time span
     * with the given number of samples per second.
     * @param robot The robot whose part you want to trace.
     * @param times The times of the frames i.e. there will be 1 frame per time
     * and that frame will correlate to the values (positions and/or angles) of
     * the robot at that time.
     * @param robotPart The part of the robot that you want to trace (an undefined
     * for the robot's position, the name of the Joint of the robot you want to trace, 
     * or the name of the Link of the robot you want to trace).
     * @param worldOrLocal Whether all positions should be w.r.t. the world
     * coordinates or w.r.t. the robot's local group. 
     * 
     * @returns One of three objects depending on what part of the robot you requested.
     */
    frameDataFor(robot:Robot, times:readonly number[], robotPart:RobotJoint, worldOrLocal?: boolean): { times: number[], jointPositions: T.Vector3[], jointAngles: number[], jointRotations: T.Quaternion[] }; // array of joint positions and array of joint angles
    frameDataFor(robot:Robot, times:readonly number[], robotPart:RobotLink, worldOrLocal?: boolean): { times: number[], linkPositions: T.Vector3[], linkRotations: T.Quaternion[] };
    frameDataFor(robot:Robot, times:readonly number[], robotPart?:undefined, worldOrLocal?: boolean): { times: number[], robotPositions: T.Vector3[], robotRotations: T.Quaternion[] };

    frameDataFor(robot:Robot, times:readonly number[], robotPart?: undefined | RobotJoint | RobotLink, worldOrLocal: boolean = true):
            { times: number[], jointPositions: T.Vector3[], jointAngles: number[], jointRotations: T.Quaternion[] } |
            { times: number[], robotPositions: T.Vector3[], robotRotations: T.Quaternion[] } |
            { times: number[], linkPositions: T.Vector3[], linkRotations: T.Quaternion[] }{

        let frameData = this.frameData(times,
            (r) => robotPart === undefined && r === robot,
            (r, l) => robotPart !== undefined && r === robot && l === robotPart,
            (r, j) => robotPart !== undefined && r === robot && j === robotPart,
            (r, j) => robotPart !== undefined && r === robot && j === robotPart,
            (r) => robotPart === undefined && r === robot,
            (r, l) => robotPart !== undefined && r === robot && l === robotPart,
            (r, j) => robotPart !== undefined && r === robot && j === robotPart,
            worldOrLocal
        );

        let robotdata = frameData.get(robot);
        if (robotdata === undefined) { throw new AssertionError({ message: "robotdata was undefined!" }); }

        // Handle robot base
        if (robotPart === undefined) {
            let pos = robotdata.positions.get(undefined);
            if (pos === undefined) { throw new AssertionError({ message: "pos was undefined!" }); }
            let rot = robotdata.rotations.get(undefined);
            if (rot === undefined) { throw new AssertionError({ message: "pos was undefined!" }); }
            return {
                times: robotdata.times,
                robotPositions: pos,
                robotRotations: rot,
            };
        }

        // Handle RobotLink robotPart case
        if (robotPart instanceof RobotLink) {
            let linkPos = robotdata.positions.get(robotPart);
            if (linkPos === undefined) { throw new AssertionError({ message: "linkPos was undefined!" }); }
            let linkRot = robotdata.rotations.get(robotPart);
            if (linkRot === undefined) { throw new AssertionError({ message: "linkPos was undefined!" }); }
            return {
                times: robotdata.times,
                linkPositions: linkPos,
                linkRotations: linkRot
            };
        }

        // Handle RobotJoint robotPart case
        let jointPos = robotdata.positions.get(robotPart);
        if (jointPos === undefined) { throw new AssertionError({ message: "jointPos was undefined!" }); }
        let jointRot = robotdata.rotations.get(robotPart);
        if (jointRot === undefined) { throw new AssertionError({ message: "jointPos was undefined!" }); }

        let jointAngles = robotdata.jointAngles.get(robotPart);
        if (jointAngles === undefined) {
            //throw new AssertionError({ message: "jointAngles was undefined!" }); 
            jointAngles = []; // the unarticulated joint does not have angle, jointAngles is set to an empty array
            // only to avoid type errors
        }

        return {
            times: robotdata.times,
            jointPositions: jointPos,
            jointAngles,
            jointRotations: jointRot,
        };
    }

    /**
     * Returns all things that can possibly traces for the given Robot.
     */
    static possibleTraces(robot: Robot): (undefined | RobotJoint | RobotLink)[] {
        let out:(undefined | RobotJoint | RobotLink)[] = [];

        // robot base
        out.push(undefined);


        // robot joints 
        for (const joint of robot.joints()) {
            out.push(joint);
        }

        // robot links
        for (const link of robot.links()) {
            out.push(link);
        }

        return out;
    }

    /**
     * Copies the contents of the given scene into this scene.
     * @param scene The scene to copy the contents of.
     * @param deep Whether the copy should be a deep copy or not.
     * @returns The given scene after it has copied the contents of this scene.
     */
    copy(scene:RobotScene, deep:boolean=false, copyName:boolean=true, cloneTrace:boolean=true): RobotScene {
        this.setParentRobotSceneManager(scene.robotSceneManager());

        // Clone robots
        let robots: Map<Robot, Robot> = new Map();
        for (const robot of scene.robots()) {
            if(robot.name() === "World Frame") continue;
            let robotClone = robot.clone();
            this.addChildRobot(robotClone);
            robots.set(robot, robotClone);
        }

        // Call parent copy method
        super.copy.call(this, scene, deep, copyName, cloneTrace, robots);

        // Clone traces
        if(cloneTrace)
        {
            for (const trace of scene._traces) {
                let [robot, robotPart, times] = [trace.robot(), trace.robotPart(), trace.times()];
                // Get the cloned version of the robot
                let thisRobot = robots.get(robot);
                if (thisRobot === undefined) { continue; }
    
                // Lookup the robot part
                if (robotPart === undefined) {
                    this.addChildTrace(thisRobot, times, robotPart);
                } else if (robotPart instanceof RobotLink) {
                    let thisLink = thisRobot.linkMap().get(robotPart.name());
                    if (thisLink === undefined) { continue; }
                    this.addChildTrace(thisRobot, times, thisLink);
                } else if (robotPart instanceof RobotJoint) {
                    let thisJoint = thisRobot.jointMap().get(robotPart.name());
                    if (thisJoint === undefined) { continue; }
    
                    // Now that we have the robot part of the clone, we can trace it
                    this.addChildTrace(thisRobot, times, thisJoint);
                } else {
                    throw new AssertionError({ message: "robotPart was not undefined, RobotLink, or RobotJoint" });
                }
            }
        }
        

        return this;
    }

    /**
     * Returns a clone of this scene.
     * @param deep Whether the clone should be a deep clone or not.
     * @returns The clone of this scene.
     */
    clone(deep:boolean=false, cloneName: boolean=true, cloneTrace:boolean=true): RobotScene {
        let copy = (new RobotScene()).copy(this, deep, cloneName, cloneTrace);
        return copy;
    }

    // --------------
    // Traces

    /**
     * Returns true if the given part of the given robot is traced and false
     * otherwise.
     * @param robot Robot querying.
     * @param robotPart The part of the robot that you are asking if is traced.
     * @returns true if the given part of the given robot is traced and false
     * otherwise.
     */
    hasChildTrace(robot:Robot, robotPart: undefined | RobotJoint | RobotLink): boolean {
        return this.getChildTrace(robot, robotPart) !== undefined;
    }

    /**
     * Generates and returns new traces for the given parameters, returning
     * the new Trace.
     * @throws AssertionError if the given Robot is not currently in a scene
     * (the Robot needs a parent RobotScene because that is how it is animated
     * to get the positions it should trace).
     * @param robot The robot to trace.
     * @param times The times of the frames that the Trace should trace.
     * @param robotPart The part of the given robot being traced.
     * @param color The color of the trace
     * @returns The computed traces.
     */
    static newTraces(robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink, color?: string, axisSize?: number, density?: number, traceSize?: number): Trace[] {
        let parent = robot.parentScene();
        if (parent === undefined) {
            APP.assert(parent !== undefined, `In "newTraces", the given Robot was not currently in a RobotScene and therefore could not be traced.`);
            throw new AssertionError(); // APP.assert will throw, but this makes sure of it.
        }
        return parent.innerNewTraces(robot, times, robotPart, color, axisSize, density, traceSize);
    }

    /**
     * Generates and returns new traces for the given parameters, returning
     * the new Trace.
     * @param robot The robot that exists in this scene and is being traced
     * @param times The times of the traces.
     * @param robotPart The part of the given robot being traced.
     * @param color The color of the traces. If undefined, then pick one from the color palettes of the current scene
     * @returns The computed traces
     */
    protected innerNewTraces(robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink, color?: string, axisSize?: number, density?: number, traceSize?: number): Trace[] {
        APP.assert(this.hasChildRobot(robot), "A RobotScene can only generate Traces for Robots that it contains.");
        let positions: Map<undefined | RobotJoint | RobotLink, T.Vector3[]>;
        let rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]> = new Map();

        if (robotPart === undefined) {
            // Need to add traces for every part of the robot;
            positions = new Map();
            positions.set(undefined, this.frameDataFor(robot, times, undefined, true).robotPositions);

            rotations.set(robotPart, this.frameDataFor(robot, times, robotPart, true).robotRotations);
        } else if (robotPart instanceof RobotJoint) {
            // need to add trace for a joint
            positions = new Map();
            positions.set(robotPart, this.frameDataFor(robot, times, robotPart, true).jointPositions);

            rotations.set(robotPart, this.frameDataFor(robot, times, robotPart, true).jointRotations);
        } else if (robotPart instanceof RobotLink) {
            // need to add trace for a link
            positions = new Map();
            positions.set(robotPart, this.frameDataFor(robot, times, robotPart, true).linkPositions);

            rotations.set(robotPart, this.frameDataFor(robot, times, robotPart, true).linkRotations);
        } else {
            throw new AssertionError({ message: "robotPart was not a boolean, RobotJoint, or RobotLink!" });
        }

        let traces:Trace[] = [];

        for (const [robotPart, points] of positions) {
            // Create the trace
            let rotation = rotations.get(robotPart);
            let robotSceneManager = this.robotSceneManager();
            if(robotSceneManager !== undefined)
            {
                let newTimespan: number[] = [robotSceneManager.currStartTime(), robotSceneManager.currEndTime()];
                // console.log(newTimespan);
                traces.push(new Trace(points, robot, robotPart, times, 
                    (density === undefined)? this._density: density, 
                    (axisSize === undefined)? this._axisSize: axisSize, 
                    (traceSize === undefined) ? this._traceSize : traceSize, newTimespan, 
                    (color === undefined) ? this.getNextColor() : color, rotation));
            }
        }
        return traces;
    }

    /**
     * Returns the Trace of the given robot's given part if it is currently in this scene.
     */
    getChildTrace(robot: Robot, part: undefined | RobotJoint | RobotLink): Trace | undefined {
        for (const trace of this._traces) {
            if (trace.robot() === robot && trace.robotPart() === part) {
                return trace;
            }
        }
        return undefined;
    }

    /**
     * Returns the Trace of the given robot's given part if it is currently in this scene.
     */
    getTrace(robot: Robot, part: undefined | RobotJoint | RobotLink): Trace | undefined {
        for (const trace of this.getAllTraces()) {
            if (trace.robot() === robot && trace.robotPart() === part) {
                return trace;
            }
        }
        return undefined;
    }

    /**
     * Adds a trace to the RobotScene. The "trace" is a 3D line that traces the
     * given Robot's part over the given time span with the given number of
     * samples. Most of the parameters are simply fed into the `framesFor`
     * method of this object in order to get what points the trace should
     * go through so go there for their descriptions.
     * 
     * Note: any given part of the robot can only have 1 trace at a time.
     */
    addChildTrace(robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink): string[] {
        let traceIds: string[] = [];
        for (const trace of RobotScene.newTraces(robot, times, robotPart)) {

            // update prevous trace if possible.
            let prevTrace = this.getChildTrace(robot, trace.robotPart());
            if (prevTrace !== undefined) {
                prevTrace.update(trace.points().map((p) => { return p.clone(); }), robot, trace.robotPart(), times, trace.traceType() ,trace.rotations().map((p) => { return p.clone(); }));
                continue;
            }

            // No previous trace so add a new one instead (trace) to the scene and record its addition so that it can be removed later
            trace.setParentScene(this);
            this._traces.push(trace);
            traceIds.push(trace.id());
            this._traceMap.set(trace.id(), trace);
        }

        if(robotPart !== undefined)
            robotPart.addToScene();
        else
            robot.addToScene();
        this._update = true;

        return traceIds
    }


    /**
     * first update the traces with new timespan
     * then update the difference between traces.
     */
    updateTraces()
    {
        let robotSceneManager = this.robotSceneManager();
        if(robotSceneManager !== undefined)
        {
            let newTimespan: number[] = [robotSceneManager.currStartTime(), robotSceneManager.currEndTime()];
            for(const trace of this.getAllTraces())
                trace.updateTimespan(newTimespan); 

            for(const [, arrow] of this._arrows)
                arrow.updateTimespan();
        }
    }

    getNextColor(): string | undefined{
        let color = this._colorPalettes.pop();
        return color;
    }
    addColorBack(color: string)
    {
        if(palettes.indexOf(color) === -1)
            return;
        this._colorPalettes.push(color);
    }
    /**
     * Removes the given trace from the given Robot.
     * 
     * @param robot The Robot to remove the trace from.
     * @param robotPart The part of the robot that the trace is of. If
     * undefined, every trace of the robot is removed.
     * @returns true if the trace was found and removed and false otherwise.
     */
    removeChildTrace(robot:Robot, robotPart?: undefined | RobotJoint | RobotLink): boolean {
        let somethingRemoved = false;
        if (robotPart === undefined) {
            for (const trace of this._traces) {
                if (trace.robot() === robot) {
                    // Remove this trace
                    let i = this._traces.indexOf(trace);
                    if (i > -1) {
                        this._traces.splice(i, 1);
                        trace.setParentScene(undefined);
                        this._traceMap.delete(trace.id());
                    }
                    somethingRemoved = true;
                    this.addColorBack(trace.color());
                }
            }
            robot.removeFromScene();
        } else {
            for (const trace of this._traces) {
                if (trace.robot() === robot && trace.robotPart() === robotPart) {
                    // Remove this trace
                    let i = this._traces.indexOf(trace);
                    if (i > -1) {
                        this._traces.splice(i, 1);
                        trace.setParentScene(undefined);
                        this._traceMap.delete(trace.id());
                    }
                    somethingRemoved = true;
                    this.addColorBack(trace.color());
                }
            }
            robotPart.removeFromScene();
        }
        if (somethingRemoved) {
            this._update = true;
            APP.updateUI();
            this.render();
            return true;
        } else {
            return false;
        }
    }

    id():Id { return this._id; }
    update(): boolean {return this._update};
    setUpdate(update: boolean) {this._update = update;}

    color(): string { return this._color; }
    setColor(newColor: string) { this._color = newColor; this.render(); }

    /**
     * Returns a read-only array of Robot objects.
     * @returns A read-only array of the Robots in this RobotScene.
     */
    robots(): ReadonlyArray<Robot> {
        return this._robots;
    }

    /**
     * Returns the T.Scene that this RobotScene uses.
     * @returns The T.Scene that this RobotScene uses.
     */
    scene():T.Scene {
        return this._scene;
    }

    setHoveredRobot(robot: Robot | undefined) {
        if (robot !== this._hoveredRobot) {
            this._hoveredRobot?.setDesaturated(false); // old robot now desaturated
            robot?.setDesaturated(true); // hovored robot not desaturated
            this._hoveredRobot = robot;
            APP.updateUI();
        }
    }

    hoveredRobot():Robot | undefined {
        return this._hoveredRobot;
    }

    setSelectedRobot(robot:Robot | undefined) {
        if (robot !== this._selectedRobot) {
            this._selectedRobot?.setHighlighted(false);
            robot?.setHighlighted(true);
            this._selectedRobot = robot;
            APP.updateUI();
        }
    }

    selectedRobot():Robot | undefined {
        return this._selectedRobot;
    }

    addChildRobot(robot:Robot) {
        robot.setParentRobotScene(this);
        this._robots.push(robot);
        APP.updateUI();
    }

    removeChildRobot(robot:Robot) {
        let i = this._robots.indexOf(robot);
        if (i > -1) {
            this.removeChildTrace(robot);
            this._robots.splice(i, 1);
            robot.setParentRobotScene(undefined);
            APP.updateUI();
        }
    }

    hasChildRobot(robot:Robot):boolean {
        return this._robots.indexOf(robot) > -1;
    }

    // -----------------------------
    // Loading Things into the Scene

    /**
     * Loads a Robot into the RobotScene from a local file.
     * @param file The local json file to find and load into the RobotScene.
     * @returns A promise that resolves when the json was successfully loaded.
     */
    async loadJsonFromLocalFile(file:File):Promise<void> {
        let json = (await loadJsonFromLocalFile(file)) as serialized_robot_scene;
        this.loadJson(json);
    }

    /**
     * Loads the json file found at the given url into the
     * RobotScene.
     * @param url The url where the json file is.
     * @returns A promise that, when complete, means that the
     * robot finished loading.
     */
    async loadJsonFromURL(url:string):Promise<void> {
        let json = (await loadJsonFromURL(url)) as serialized_robot_scene;
        this.loadJson(json);
    }

    /**
     * Loads the given json object into the RobotScene.
     * @param jsonObj The json object to load into the RobotScene.
     */
    async loadJson(jsonObj:serialized_robot_scene) {
        await RobotScene.deserialize(this._robotSceneManager.value(), jsonObj, this);

        // This is called after deserialization completes
        this.render(); // async so may not render new scene instantly
        APP.updateUI(); // also async
    }

    /**
     * Saves this RobotScene as Json to the given file location.
     * @param fileName The file path to the file to save the RobotScene to.
     */
    saveAsJsonTo(fileName:string) {
        saveToJson(this.serialize(), fileName, 4);
    }

    /**
     * Loads one or more URDFs into the scene, assuming that they are stored locally.
     * @param files The list of files to load, gotten from a FileUploader UI element.
     */
//    loadRobotFromLocalFile(files:FileList) {
//        loadURDFFromLocal(files, (blob:Blob) => {
//            console.log(blob); // TODO
//            this.render();
//        });
//    }

    /**
     * Loads a URDF from a URL into the RobotScene.
     * @param url The URL link to load the URDF from.
     * @returns a Promise that resolves to a Robot object after it has been
     * added to the scene.
     */
    async loadRobotFromURL(url:string, name:string = ""):Promise<Robot> {
        try {
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingStarted,  type: "example robot" });
            let robot = await Robot.loadRobot(url, undefined, name);
            this.addChildRobot(robot);
            this.render();
            // Display a success message when the robot is loaded successfully
            const successMessage = `Robot ${robot.name()} Uploaded Successfully!`;
            const successElement = document.createElement("p");
            successElement.innerText = successMessage;
            successElement.classList.add("LoadRobotMessage"); // Optional: Add additional styles to the success message

            const panelElement = document.querySelector(".LoadAndSavePanel");
            const loadRobotElement = panelElement?.querySelector(".LoadRobot");
            loadRobotElement?.appendChild(successElement);
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingSuccess,  type: "example robot" });
            return robot;
        } catch (error) {
            // Display an error message when the URL is not valid
            const errorMessage = 'Error loading robot: ' + error;
            const errorElement = document.createElement('p');
            errorElement.innerText = errorMessage;
            errorElement.style.color = 'red';  // Example of adding a style
            errorElement.classList.add("LoadRobotMessage");
            const panelElement = document.querySelector('.LoadAndSavePanel');
            const loadRobotElement = panelElement?.querySelector(".LoadRobot");
            loadRobotElement?.appendChild(errorElement);
            APP.setPopupHelpPage({ page: PopupHelpPage.LoadingFailed,  type: "example robot" });
            // Optionally, you can throw the error again to propagate it to the caller
            throw error;
        }
    }

    async addEETarget():Promise<Robot> {
        let robot = Robot.createAxesHelper(0.1, "EE Target " + this._num_ee_targets);
        this._num_ee_targets += 1;
        this.addChildRobot(robot);
        this.render();
        return robot;
    }

    addWorldFrame():T.Object3D {
        // add world frame object directly to the scene
        // do not add world frame object to the scene's children robots
        let worldFrameObject: T.Object3D = new T.AxesHelper(1);
        this._worldFrameObject = worldFrameObject;
        this.scene().add(worldFrameObject);
        this.render();
        return worldFrameObject;
    }

    // ----------
    // Serialization

    /**
     * Serializes this RobotScene into an object that can be jsonified and
     * written to a file.
     */
    serialize():serialized_robot_scene {
        let robots:serialized_robot[] = [];

        for (const robot of this._robots) {
            robots.push(robot.serialize());
        }

        let animationTables:serialized_animation_table[] = [];

        return {
            id: this.id().value(),
            robots: robots,
            animationManager: this._animationManager.serialize(),
            animationTables: animationTables,
        };
    }

    /**
     * Deserializes a serialized RobotScene into a RobotScene object.
     * @param uSerial A RobotScene either serialized in the old serialization format or the new one.
     * @param donor The optional RobotScene to put the contents of the serial
     * into. If it is undefined, then a new RobotScene object is used and
     * returned instead.
     * @returns A Promise that resolves to a deserialized RobotScene.
     */
    static async deserialize(manager: RobotSceneManager | undefined, uSerial:serialized_robot_scene | old_serialized_robot_scene, donor?:RobotScene):Promise<RobotScene> {
        let _donor:RobotScene = donor ?? new RobotScene(manager);

        // (robotFiles is a field only in the old serialization format)
        if ((uSerial as old_serialized_robot_scene).robotFiles !== undefined) {
            return await this.oldDeserialize(manager, uSerial as old_serialized_robot_scene, _donor);
        }

        let serial: serialized_robot_scene = uSerial as serialized_robot_scene;

        // Deserialize all the robots concurrently
        let deserializedRobots:Promise<Robot>[] = [];
        for (const robot of serial.robots) {
            deserializedRobots.push(Robot.deserialize(robot));
        }
        let robots = await Promise.all(deserializedRobots);

        // Deserialize AnimationTables
        let atProms = [];
        for (const at of serial.animationTables) {
            atProms.push(AnimationTable.deserialize(at));
        }
        let ats = await Promise.all(atProms);

        let atsById:Map<string, AnimationTable> = new Map();
        for (const at of ats) atsById.set(at.idValue(), at);

        let objsByID:Map<string, Robot> = new Map();
        for (const robot of robots) objsByID.set(robot.id().value(), robot);

        // Now deserialize the AnimationManager
        if (serial.animationManager) {
            // Passing donor animationManager will deserialize into that
            // AnimationManager, so we do not need to do anything else after
            // waiting for the deserialization to complete
            await AnimationManager.deserialize(serial.animationManager, objsByID, atsById, _donor.animationManager());
        }

        // Now regen IDs of the AnimationTables so that they do not conflict
        // with other ones that may be loaded in later or have already been loaded in
        for (const at of ats) at.id().regen();

        // Now Add the robots to the scene
        for (const robot of robots) {
            robot.id().regen(); // generate new ID for each one in case the same robot is deserialized again (every robot, even duplicates, should have unique IDs from this point onward)
            _donor.addChildRobot(robot);
        }

        // Change the time so that they all robots are at the first step of the animation.
        _donor.animationManager().setTime(0);

        for (const at of ats) APP.addAnimationTable(at);

        // Return the Scene
        return _donor;
    }

    /**
     * The serialization Json used to look different so this method will handle it
     *      if it is in the old format.
     */
    static async oldDeserialize(manager: RobotSceneManager | undefined, serial:old_serialized_robot_scene, donor?:RobotScene, fromGazebo:boolean=true):Promise<RobotScene> {
        let _donor:RobotScene = donor ?? new RobotScene(manager);

        // Concurrently load in all urdfs into the ThreeScene
        let robotProms:Promise<Robot>[] = [];
        for (const url of serial.robotFiles) {
            robotProms.push(_donor.loadRobotFromURL(url));
        }
        let robots:Robot[] = await Promise.all(robotProms);

        // Build a map of the robots and set their positions/rotations
        let configsUsed:number = 0;
        let robotsByIds:Map<string, Robot> = new Map();
        for (const [i, robot] of enumerate(robots)) {
            robotsByIds.set(robot.id().value(), robot);

            let currScl:T.Vector3 = robot.getScaleOffset();
            let currPos:T.Vector3 = robot.getPositionOffset();
            let currRot:T.Euler = new T.Euler().setFromQuaternion(robot.getQuaternionOffset());
            let relScl:T.Vector3 = robot.getScale();
            let relPos:T.Vector3 = robot.getPosition();
            let relRot:T.Euler = new T.Euler().setFromQuaternion(robot.getQuaternion());

            // Move robot based on its position
            let configsNeeded = serial.configsMap[i];
            for (let j = 0; j < configsNeeded; j++) {
                let k = configsUsed + j;
                let config = serial.configs[k];
                switch (j) {
                    // Absolute
                    case 0: currScl.set(config, config, config); break;
                    case 1: currPos.x = config; break;
                    case 2: currPos.y = config; break;
                    case 3: currPos.z = config; break;
                    case 4: currRot.x = config; break;
                    case 5: currRot.y = config; break;
                    case 6: currRot.z = config; break;

                    // Relative
                    //case 7:  relScl.set(config, config, config); break;
                    case 7:  relPos.x = config; break;
                    case 8:  relPos.y = config; break;
                    case 9:  relPos.z = config; break;
                    case 10: relRot.x = config; break;
                    case 11: relRot.y = config; break;
                    case 12: relRot.z = config; break;

                    // The rest are joints
                    default:
                        let joint = robot.joints()[j - 12];
                        if (joint) {
                            joint.setAngle(config);
                        }
                }
            }
            configsUsed += configsNeeded;

            if (fromGazebo) {
                robot._robot.rotation.x = -Math.PI / 2; // Absolute position of the object must be changed
            }

            robot.setScaleOffset(currScl);
            robot.setPositionOffset(currPos);
            robot.setQuaternionOffset(new T.Quaternion().setFromEuler(currRot));
            robot.setScale(relScl);
            robot.setPosition(relPos);
            robot.setQuaternion(new T.Quaternion().setFromEuler(relRot));
        }

        // Load in AnimationTables
        let atProms:Promise<AnimationTable[]>[] = [];
        for (const url of serial.animationURLs) {
            atProms.push((async ():Promise<AnimationTable[]> => {
                let ats = await AnimationTable.loadFromURL(url);
                for (const at of ats) {
                    at.fromGazebo = fromGazebo;
                }
                return ats;
            })());
        }
        let ats = await Promise.all(atProms);

        let animsTaken:number = 0;
        let animationMap:number[] = serial.animationMap;
        let animationGroup:AnimationGroup = new AnimationGroup();

        // Assemble the animations
        for (const [i, robot] of enumerate(robots)) {
            for (let j = 0; j < animationMap[i]; j++) {
                let res = ats[animsTaken++];
                if (res && res.length > 0) animationGroup.addAnimation(new Animation(robot, res[0]));
            }
        }

        if (animationGroup.animations().length > 0) {
            _donor.animationManager().addActiveAnimation(
                animationGroup
            );
            _donor.animationManager().setTime(0);
        }
        
        return _donor;
    }
}