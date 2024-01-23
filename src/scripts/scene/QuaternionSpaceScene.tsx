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
import { QuaternionTrace } from '../objects3D/QuaternionTrace';
import { RobotScene } from './RobotScene';

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
const palettes = ["rgb(255, 255, 0)", "brown", /*"white",*/ "red", "#204BD8", "purple", "green"];
var numQScenes:number = 0;

/**
 * An encapsulation of a ThreeScene that specifically should be used for holding
 * the traces in quaternion space
 */
export class QuaternionSpaceScene extends ThreeScene {
    protected _id: Id;
    protected _name: string;

    // Traces that are owned by this scene.
    protected _traces: QuaternionTrace[];

    protected _color: string;

    protected _colorPalettes: string[]; // the colors of the traces

    protected _robotSceneManager: RobotSceneManager | undefined;

    protected _update: boolean; // whether traces are added or removed

    protected _lineGroup: T.Group; // the group of the longitude and latitude of the sphere
    protected _lineGroupOpacity: number; // the opacity of the longitude and latitude
    protected _lineGroupColor: string; // the color of the longitude and latitude

    protected _backgroundColor: string;

    protected _worldFrameObject: T.Object3D; // the actual world frame object

    constructor(parentRobotSceneManager?: RobotSceneManager, id?:string) {
        super();

        this._id = new Id(id);
        this._color = randColor();
        this._name = "Quat Space " + (++numQScenes);

        this._colorPalettes = [...palettes];

        this._update = false;

        this._traces = [];

        this._worldFrameObject = new T.Object3D();

        this._lineGroup = new T.Group();
        this._lineGroupOpacity = 0.1;
        this._lineGroupColor = "#00ff00";
        this.createInitialSphere();
        this.addWorldFrame();

        this._backgroundColor = "#263238"; // default background color of the scene
        this._robotSceneManager = parentRobotSceneManager;

        if(parentRobotSceneManager !== undefined)
            parentRobotSceneManager.addQuaternionSpaceScene(this);
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

    addWorldFrame():T.Object3D {
        // add world frame object directly to the scene
        // do not add world frame object to the scene's children robots
        let worldFrameObject: T.Object3D = new T.AxesHelper(1);
        this._worldFrameObject = worldFrameObject;
        this.scene().add(worldFrameObject);
        this.render();
        return worldFrameObject;
    }

    getAllTraces(): QuaternionTrace[]
    {
        let result: QuaternionTrace[] = [...this._traces];
        return result;
    }

    removeAllTraces()
    {
        let traces = [...this._traces];
        for(const trace of traces)
            this.removeChildTrace(trace.robot(), trace.robotPart());
    }


    /**
     * @returns The parent RobotSceneManager of this RobotScene.
     */
    robotSceneManager(): RobotSceneManager | undefined {
        return this._robotSceneManager;
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
     * extract frame data and store them in a map
     * @param robotScene 
     * @param robot 
     * @param times 
     * @param robotPart 
     * @returns 
     */
    static extraceDataFromframeData(robotScene: RobotScene, robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink): Map<undefined | RobotJoint | RobotLink, T.Quaternion[]>
    {
        let rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]> = new Map();
        
        if (robotPart === undefined) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).robotRotations);
        } else if (robotPart instanceof RobotJoint) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).jointRotations);
        } else if (robotPart instanceof RobotLink) {
            rotations.set(robotPart, robotScene.frameDataFor(robot, times, robotPart, true).linkRotations);
        } else {
            throw new AssertionError({ message: "robotPart was not a boolean, RobotJoint, or RobotLink!" });
        }
        return rotations;
    }
    /**
     * Generates and returns new traces for the given parameters, returning
     * the new Trace.
     * @param robotScene 
     * @param robot 
     * @param times 
     * @param robotPart 
     * @param color 
     * @returns 
     */
    protected innerNewTraces(robotScene: RobotScene, robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink, color?: string): QuaternionTrace[] {
        // APP.assert(this.hasChildRobot(robot), "A RobotScene can only generate Traces for Robots that it contains.");
        let robotSceneManager = this.robotSceneManager();
        if(robotSceneManager === undefined) return [];
        let rotations: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]> = QuaternionSpaceScene.extraceDataFromframeData(robotScene, robot, times, robotPart);
        

        let traces:QuaternionTrace[] = [];

        for (const [robotPart, points] of rotations) {
            // Create the trace
            let rotation = rotations.get(robotPart);
            if(rotation !== undefined)
            {
                let newTimespan: number[] = [robotSceneManager.currStartTime(), robotSceneManager.currEndTime()];
                // console.log(newTimespan);
                traces.push(new QuaternionTrace(rotation, robot, robotPart, times, newTimespan, robotSceneManager.currTime(), (color === undefined) ? this.getNextColor() : color));
            }
        }
        return traces;
    }

    /**
     * Returns the Trace of the given robot's given part if it is currently in this scene.
     */
    getChildTrace(robot: Robot, part: undefined | RobotJoint | RobotLink): QuaternionTrace | undefined {
        for (const trace of this._traces) {
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
    addChildTrace(robotScene: RobotScene, robot:Robot, times: number[], robotPart?: undefined | RobotJoint | RobotLink) {
        for (const trace of this.innerNewTraces(robotScene, robot, times, robotPart)) {

            // update prevous trace if possible.
            let prevTrace = this.getChildTrace(robot, trace.robotPart());
            if (prevTrace !== undefined) {
                prevTrace.update(trace.quaternions().map((p) => { return p.clone(); }), robot, trace.robotPart(), times, trace.traceType());
                continue;
            }

            // No previous trace so add a new one instead (trace) to the scene and record its addition so that it can be removed later
            trace.setParentScene(this);
            this._traces.push(trace);
        }

        if(robotPart !== undefined)
            robotPart.addToScene();
        else
            robot.addToScene();
        this._update = true;
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
        }
    }

    /**
     * update all trace symbols
     * this function will be called when the current time changes
     */
    updateTraceSymbols()
    {
        let robotSceneManager = this.robotSceneManager();
        if(robotSceneManager !== undefined)
        {
            for(const trace of this.getAllTraces())
                trace.updateSymbolGeom(robotSceneManager.currTime());
        }
    }

    createInitialSphere(size:number=1, opacity: number=0.1)
    {
        const latitudes = 16; // Number of latitude lines
        const longitudes = 20; // Number of longitude lines
        let geometry = new T.SphereGeometry(size, longitudes, latitudes);
        let material = new T.MeshStandardMaterial({
            transparent: true,
            opacity: opacity,
        });
        let sphere = new T.Mesh(geometry, material);
        sphere.rotation.x = Math.PI / 2;
        this.scene().add(sphere);
        // Create lines for latitude and longitude
        

        const lineMaterial = new T.LineBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true,
            opacity: this._lineGroupOpacity,
            side: T.DoubleSide,
         });
         
        let lineGroup = new T.Group();
        // Create lines for latitudes
        for (let i = 1; i < latitudes; i++) {
            const latitude = (Math.PI / latitudes) * i - Math.PI / 2;
            const points = [];

            for (let j = 0; j <= longitudes; j++) {
                const longitude = (Math.PI * 2 / longitudes) * j - Math.PI;
                const point = new T.Vector3(
                    Math.cos(latitude) * Math.cos(longitude),
                    Math.cos(latitude) * Math.sin(longitude),
                    Math.sin(latitude),
                ).multiplyScalar(size);

                points.push(point);
            }

            const geometry = new T.BufferGeometry().setFromPoints(points);
            const line = new T.Line(geometry, lineMaterial);

            lineGroup.add(line);
        }

        // Create lines for longitudes
        for (let i = 0; i <= longitudes; i++) {
            const longitude = (Math.PI * 2 / longitudes) * i - Math.PI;
            const points = [];

            for (let j = 0; j <= latitudes; j++) {
                const latitude = (Math.PI / latitudes) * j - Math.PI / 2;
                const point = new T.Vector3(
                    Math.cos(latitude) * Math.cos(longitude),
                    Math.cos(latitude) * Math.sin(longitude),
                    Math.sin(latitude),
                ).multiplyScalar(size);

                points.push(point);
            }

            const geometry = new T.BufferGeometry().setFromPoints(points);
            const line = new T.Line(geometry, lineMaterial);

            lineGroup.add(line);
        }
        this._lineGroup = lineGroup;
        this.scene().add(lineGroup);
    }

    setLineGroupOpacity(opacity: number){
        this._lineGroupOpacity = opacity;
        this._lineGroup.traverse(function (child) {
            if (child instanceof T.Line) {
                // Check if the child has a material
                if (child.material) {
                    // Set the opacity for the material
                    child.material.opacity = opacity;
                    // Make sure the material is transparent
                    child.material.transparent = true;
                }
            }
        });
        this.render();
    }

    lineGroupOpacity(): number{
        return this._lineGroupOpacity;
    }

    setLineGroupColor(color: string){
        this._lineGroupColor = color;
        this._lineGroup.traverse(function (child) {
            if (child instanceof T.Line) {
                // Check if the child has a material
                if (child.material) {
                    child.material.color = new T.Color(color);
                }
            }
        });
        this.render();
    }

    lineGroupColor(): string{
        return this._lineGroupColor;
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
     * Returns the T.Scene that this RobotScene uses.
     * @returns The T.Scene that this RobotScene uses.
     */
    scene():T.Scene {
        return this._scene;
    }
}