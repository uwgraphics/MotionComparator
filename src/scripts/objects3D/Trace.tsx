import T  from "../true_three";
import { APP } from "../constants";
import { isMesh } from "../gaurds";
import { clamp, randColor, recurseMaterialTraverse } from "../helpers";
import { RobotScene } from "../scene/RobotScene";
import { Robot } from "./Robot";
import { RobotJoint } from "./RobotJoint";
import { RobotLink } from "./RobotLink";
import { SubscribeArrayWithArg } from "../subscriptable/SubscribeArrayWithArg";
import { SubscriptableValue } from "../subscriptable/SubscriptableValue";
import { Id } from "../Id";

/**
 * Enum for the base "shape" of the trace.
 */
export const TRACETYPE = {
    LINE: "line",
    TUBE: "tube",
    CONE: "cone",
} as const;
export type TRACETYPE = typeof TRACETYPE[keyof typeof TRACETYPE];
export const defaultTraceBase = TRACETYPE.CONE;

/**
 * Enum for the base modifier of the trace i.e. what the trace shows.
 */
const TRACEMOD = {

} as const;
type TRACEMOD = typeof TRACEMOD[keyof typeof TRACEMOD];


/**
 * Traces an object's path through a scene i.e. is a line shown the scene
 * tracing the path of a part of an object.
 */
export class Trace {
    protected _id;
    protected _parentScene: SubscriptableValue<RobotScene | undefined>; // The scene that the Trace is in
    protected _points: T.Vector3[];
    //protected _currGeom: T.Object3D;
    protected _currPosGeom: T.Object3D; // the orignal trace geometry i.e. cones
    protected _currPosGeomArray: T.Object3D[];
    protected _color: string;
    protected _is_visible: boolean;
    protected _opacity: number;

    protected _rootGroup: T.Group;

    protected _trace_type: TRACETYPE;

    // The Robot that the Trace is tracing.
    protected _parentRobot: Robot;
    protected _robotPart:  RobotJoint | RobotLink | undefined;
    protected _times: number[];

    // the orientations of the object at different positions
    // use axis to visualize the orienetation
    // density controls the distance between two adjacent axis
    protected _currRotGeom: T.Object3D; // the rotation geomerty, i.e. axis
    protected _currRotGeomArray: T.Object3D[];
    protected _rotations: T.Quaternion[];
    protected _density: number;
    protected _axisSize: number;

    protected _traceSize: number;

    protected _timespan: number[]; // store the value of the curremt timespan
    protected _timespanIndex: number[]; // store the index of the timespan index in their orignal _times array

    constructor(
            points: T.Vector3[],
            robot: Robot,
            robotPart: RobotJoint | RobotLink | undefined,
            times: number[],
            density: number,
            axisSize: number,
            traceSize: number,
            timespan: number[],
            color?: string,
            rotations?: T.Quaternion[],
            traceType: TRACETYPE = defaultTraceBase,
    ) {
        if(color === undefined)
            this._color = randColor();
        else
            this._color = color;
        this._trace_type = defaultTraceBase;

        this._id = new Id().value();
        this._timespan = timespan;
        this._timespanIndex = [];
        // console.log(this._timespanIndices);

        this._currPosGeomArray = [];
        this._currRotGeomArray = [];
        
        this._rootGroup = new T.Group();
        this._currPosGeom = this.newPosGeom();
        this._rootGroup.add(this._currPosGeom);

        this._currRotGeom = this.newRotGeom();
        this._rootGroup.add(this._currRotGeom);

        this._is_visible = true;

        this._points = [];
        this._parentRobot = robot;
        this._robotPart = robotPart;
        this._times = times;
        this._opacity = 1;

        this._rotations = [];
        this._density = density;
        this._axisSize = axisSize;

        this._traceSize = traceSize;
        console.log(traceSize);
        
        this._parentScene = new SubscriptableValue(undefined) as SubscriptableValue<RobotScene | undefined>;
        this.update(points, robot, robotPart, times, traceType, rotations);

        let _this = new WeakRef(this); // weakref so that neither function holds onto this object.

        robot.afterParentSceneSet().subscribe((([, newParent]) => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }

            if (newParent === undefined) {
                __this.setParentScene(undefined);
                return false;
            } else {
                __this.updatePoints();
            }
            return true;
        }))

        robot.afterpositionOffsetSet().subscribe((() => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }
            __this.updatePoints();
            return true;
        }));
    }

    id(): string{
        return this._id;
    }

    density(): number{
        return this._density;
    }

    setDensity(density: number){
        this._density = density;
        this.updateRot(this._rotations);
    }

    axisSize(): number{
        return this._axisSize;
    }

    setAxisSize(axisSize: number)
    {
        this._axisSize = axisSize;
        this.updateRot(this._rotations);
    }

    rotations(): T.Quaternion[]
    {
        return this._rotations;
    }

    timespanIndex(): number[]
    {
        return this._timespanIndex;
    }

    /**
     * update the traces according to the new timespan
     * @param newTimespan 
     * @returns 
     */
    updateTimespan(newTimespan: number[])
    {
        if(newTimespan.length !== 2 || this._times === undefined) return;
        this._timespan = newTimespan;
        let startIndex = 0, endIndex = this._times.length-1;
        if (this._parentRobot.parentScene()?.isTimeWarping()) {
            // update the timespan for the timewarped traces
            // need to use the time warp map to find its time after time warping
            let time_map = this._parentRobot.parentScene()?.timeWarping()?.timeWarpMap();
            let time_index_map = this._parentRobot.parentScene()?.timeWarping()?.indexMap();
            if (time_map === undefined || time_index_map === undefined) return;

            for (let i = 0; i < time_map[1].length; i++) {
                if (time_map[0][i] >= newTimespan[0]) {
                    startIndex = time_index_map[1][i];
                    break;
                }
            }
            for (let i = time_map[1].length - 1; i >= 0; i--) {
                if (time_map[0][i] <= newTimespan[1]) {
                    endIndex = time_index_map[1][i];
                    break;
                }
            }
            // console.log("start time " + newTimespan[0]);
            // console.log(time_map[0]);
            // console.log(time_map[1]);
            // console.log("start index " + startIndex + " end index " + endIndex);
        }
        else {
            // non time warped traces
            for (let i = 0; i < this._times.length; i++) {
                if (this._times[i] >= newTimespan[0]) {
                    startIndex = i;
                    break;
                }
            }
            for (let i = this._times.length - 1; i >= 0; i--) {
                if (this._times[i] <= newTimespan[1]) {
                    endIndex = i;
                    break;
                }
            }
        }
        // console.log("time length is " + this._times.length);
        this._timespanIndex = [startIndex, endIndex];
        //console.log(this._times.length + " " + this._points.length + " " + this._currPosGeomArray.length);
        
        for(let i=0; i<this._currPosGeomArray.length; i++)
        {
            if(this._currPosGeomArray[i] === undefined) continue;
            if(i < startIndex || i > endIndex)
            {
                this._currPosGeomArray[i].visible = false;
            }
                
            else
                this._currPosGeomArray[i].visible = true;
        }
        let step = Math.round(1 / this._density);
        // console.log(this._currRotGeomArray);
        for(let i=0; i<this._currRotGeomArray.length; i+=step)
        {
            if(this._currRotGeomArray[i] === undefined) continue;
            if(i < startIndex || i > endIndex)
                this._currRotGeomArray[i].visible = false;
            else
                this._currRotGeomArray[i].visible = true;
        }
        this.parentScene()?.render();
    }

    /**
     * update the scale of the position traces
     * @param scale 
     */
    setTraceSize(scale: number)
    {
        for(let i=0; i<this._currPosGeomArray.length; i++)
        {
            if(this._currPosGeomArray[i] === undefined) continue;
            this._currPosGeomArray[i].scale.set(scale, scale, scale);
        }
        this._traceSize = scale;
        this.parentScene()?.render();
    }

    protected updatePoints(): boolean {
        let robot = this.robot();
        let robotScene = robot.parentScene();
        if (robotScene) {
            // Can and should update Trace points
            let robotPart = this.robotPart();
            let newPoints: T.Vector3[];
            if (robotPart instanceof RobotJoint) {
                newPoints = robotScene.frameDataFor(robot, this.times(), robotPart, true).jointPositions;
            } else if (robotPart instanceof RobotLink) {
                newPoints = robotScene.frameDataFor(robot, this.times(), robotPart, true).linkPositions;
            } else {
                throw new Error("Invalid robotPart type");
            }
            this.setPoints(newPoints);
        } else {
            return false;
        }
        return true;
    }

    beforeParentSceneSet(): SubscribeArrayWithArg<[RobotScene | undefined, RobotScene | undefined]> {
        return this._parentScene.beforeSet();
    }

    afterParentSceneSet(): SubscribeArrayWithArg<[RobotScene | undefined, RobotScene | undefined]> {
        return this._parentScene.afterSet();
    }

    robot(): Robot { return this._parentRobot; }
    robotPart(): RobotJoint | RobotLink | undefined { return this._robotPart; }
    times(): number[] { return this._times }
    color(): string{return this._color;}
    /**
     * Traverses all T.Mesh objects of this Robot, calling
     * the give callback with each one.
     * @param callback The callaback to call with each mesh.
     */
    traverseMeshes(callback:(mesh:T.Mesh) => void) {
        this._rootGroup.traverse((obj) => {
            if (isMesh(obj)) {
                callback(obj);
            }
        });
    }

    /**
     * Traverses all T.Materials of this Robot, calling the given callback with
     * each one.
     * @param callback The callback to call with each material.
     */
    traverseMaterials(callback:(mat:T.Material) => void) {
        this._rootGroup.traverse((obj) => {
                recurseMaterialTraverse(
                    // @ts-ignore
                    obj.material,
                    callback
                );
        });
    }

    /**
     * Returns true if this Trace object is visible and false otherwise.
     * @returns true if this Trace object is visible and false otherwise.
     */
    visible(): boolean {
        return this._is_visible;
    }

    /**
     * Sets whether the Trace should be visible from now on.
     * @param visible true if this Trace should be visible from now on and false
     * if it should not be visible from now on.
     */
    setVisible(visible: boolean) {
        if (visible === this._is_visible) { return; }

        this.traverseMeshes((obj) => {
            obj.visible = visible;
        });

        this._is_visible = visible;

        APP.updateUI();
        APP.render();
    }

    /**
     * Sets the opacity of this Trace.
     * @param opacity The new opacity (in range [0, 1]) of the Trace.
     */
    opacity(): number {
        return this._opacity;
    }

    /**
     * Sets the opacity of this Robot.
     * @param opacity The new opacity (in range [0, 1]) of the Robot.
     */
    setOpacity(opacity:number) {
        this._opacity = clamp(opacity, 0, 1);
        this.traverseMaterials((mat) => {
            mat.opacity = this._opacity;
        });
        APP.updateUI();
        APP.render();
    }

    // setColor(color?: string)
    // {
    //     if(color === undefined)
    //         this._color = randColor();
    //     else
    //         this._color = color;
        
    //     this.update(this._points, this._parentRobot, this._robotPart, this._times, this._trace_type);
    //     APP.updateUI();
    //     APP.render();
    // }

    /**
     * @returns The trace's current parent RobotScene. This is the scene that
     * the Trace is actually displayed in.
     */
    parentScene(): RobotScene | undefined {
        return this._parentScene.value();
    }

    setTraceType(newTraceType: TRACETYPE) {
        this.update(this._points, this._parentRobot, this._robotPart, this.times(), newTraceType);
    }

    traceType(): TRACETYPE {
        return this._trace_type;
    }

    /**
     * @param points The points for the trace to trace through.
     * @returns The ThreeObject that goes through all the given points.
     */
    protected newPosGeom(points: T.Vector3[] | undefined=undefined, traceType: TRACETYPE=defaultTraceBase,): T.Object3D {
        if (points === undefined) {
            points = [];
        }

        // Need at least 2 points to trace through
        if (points.length === 0) { points.push(new T.Vector3(), new T.Vector3()); }
        else if (points.length === 1) { points.push(points[0].clone()); }

        const lineCurve = new T.CatmullRomCurve3(points, false);

        if (traceType === TRACETYPE.LINE) {
            const lineGeom = new T.BufferGeometry().setFromPoints(lineCurve.getPoints(points.length));
            const lineMat = new T.LineBasicMaterial({ color: new T.Color(this._color).convertSRGBToLinear() });
            return new T.Line(lineGeom, lineMat);

        } else if (traceType === TRACETYPE.TUBE) {
            const geometry = new T.TubeGeometry( lineCurve, points.length * 2, 0.005, 8, true );
            const material = new T.MeshBasicMaterial( { color: new T.Color(this._color).convertSRGBToLinear()} );
            return new T.Mesh( geometry, material );

        } else if (traceType === TRACETYPE.CONE) {
            let coneLine = new T.Group();
            const rotationMatrix = new T.Matrix4();
            const material = new T.MeshBasicMaterial( { color: new T.Color(this._color).convertSRGBToLinear() } );
            this._currPosGeomArray = [];
            for (let i = 0; i < (points.length - 1); i++) {
                const currPt = points[i];
                const nextPt = points[i + 1];

//                let marker = (new T.Mesh(
//                    new SphereGeometry(0.001, 10, 10),
//                    new T.MeshLambertMaterial({ color: "red" })
//                ));
//                marker.position.copy(currPt);
//                coneLine.add(marker);
                
                const dist = currPt.distanceTo(nextPt);
                if (dist === 0) { continue; }
                const coneRadius = 0.005;
                const coneHeight = dist;
                const coneMesh = new T.Mesh(
                    new T.ConeGeometry(coneRadius, coneHeight),
                    material
                );                    
                // Cone starts off with weird rotation, so rotate it in a group
                // such that the `lookAt` method retates its tip towards the
                // target.
                coneMesh.rotateX(Math.PI / 2);
                const cone = new T.Group();
                cone.add(coneMesh);

                cone.position.copy(currPt);
                rotationMatrix.lookAt(nextPt, currPt, cone.up);
                cone.quaternion.setFromRotationMatrix(rotationMatrix);

                // Move cone half its length towards the new point
                let direction = new T.Vector3();
                direction.subVectors(nextPt, currPt).normalize();
                cone.position.addScaledVector(direction, dist / 2);

                coneLine.add(cone);
                this._currPosGeomArray[i] = cone;
                this._currPosGeomArray[i].scale.set(this._traceSize, this._traceSize, this._traceSize);
            }

            this.updateTimespan(this._timespan);
            return coneLine;
        } else {
            throw new Error(`Unknown LineTraceType "${traceType}"`);
        }
    }

    /**
     * @param points The points for the trace to trace through.
     * @returns The ThreeObject that goes through all the given points.
     */
    protected newRotGeom(rotations?: T.Quaternion[]): T.Object3D {
        if(rotations === undefined) rotations = this._rotations;
        let points = this._points;
        if (points === undefined) {
            points = [];
        }

        // Need at least 2 points to trace through
        if (points.length === 0) { points.push(new T.Vector3(), new T.Vector3()); }
        else if (points.length === 1) { points.push(points[0].clone()); }


        let axisGroup = new T.Group();
        let step = Math.round(1 / this._density);
        this._currRotGeomArray = [];
        // console.log(step);
        for (let i = 0; i < (points.length - 1); i += step) {
            const currPt = points[i];
            const axis = new T.AxesHelper(this._axisSize);
            if (rotations !== undefined) {
                // console.log("input");
                // console.log(rotations[i]);
                axis.setRotationFromQuaternion(rotations[i]);
                // console.log("output");
                // console.log(axis.getWorldQuaternion(new T.Quaternion()));
            }
            axis.position.copy(currPt);
            axisGroup.add(axis);
            this._currRotGeomArray[i] = axis;
        }

        this.updateTimespan(this._timespan);
        return axisGroup;
    }

    /**
     * @param newParentScene The new parent scene of this Trace.
     */
    setParentScene(newParentScene: RobotScene | undefined) {
        if (newParentScene === this._parentScene.value()) { return; }

        this._parentScene.setValue(
            (oldScene, _) => {
                // Remove this trace from its current scene
                if (oldScene) {
                    oldScene.scene().remove(this._rootGroup);
                    oldScene.render();
                }
            },
            newParentScene,
            (_, newScene) => {
                // Add it to its new scene
                if (newScene !== undefined) {
                    newScene.scene().add(this._rootGroup);
                    newScene.render();
                }
            }
        )
        APP.updateUI();
    }

    /**
     * Returns the points that the trace currently goes through.
     * @returns The points that this trace goes through.
     */
    points(): ReadonlyArray<T.Vector3> {
        return this._points;
    }

    /**
     * Clones this Trace's points and returns the cloned list of vectors.
     */
    clonedPoints(): T.Vector3[] {
        return this._points.map((v) => { return v.clone(); })
    }

    /**
     * Sets this trace to go through the given points.
     * @param newPoints The new points that this Trace should have.
     */
    setPoints(newPoints: T.Vector3[]) {
        this.update(newPoints, this._parentRobot, this._robotPart, this.times(), this._trace_type);
    }
    
    /**
     * Updates the Trace so that it has the given args.
     */
    update(
            newPoints: T.Vector3[],
            robot: Robot,
            robotPart: RobotJoint | RobotLink | undefined,
            times: number[],
            traceType: TRACETYPE=defaultTraceBase,
            rotations?: T.Quaternion[]
    ) {
        this._points = newPoints;
        this._parentRobot = robot;
        this._robotPart = robotPart;
        this._times = times;

        if(rotations !== undefined)
            this._rotations = rotations;
        
        this.updateRot(rotations); // update points/times needs to update both position and rotation geometry

        // Create the new geometry
        let line = this.newPosGeom(newPoints, traceType);

        // Remove the old geometry
        this._rootGroup.remove(this._currPosGeom);

        this._currPosGeom = line;

        this._rootGroup.add(this._currPosGeom);

        this._trace_type = traceType;
    }

    /**
     * update the rotation
     * this function will be called when updating the axis size or the density
     * The reason to create a separate function from the update function is to avoid
     * updating the position geometry unnecessarily
     * @param rotations 
     */
    updateRot(rotations?: T.Quaternion[])
    {
        // Create the new geometry
        let axis = this.newRotGeom(rotations);

        // Remove the old geometry
        this._rootGroup.remove(this._currRotGeom);

        this._currRotGeom = axis;

        this._rootGroup.add(this._currRotGeom);
    }


    
    /**
     * Note: The clone does not possess any controlled clones. It is just a
     * clone of the trace itself.
     * @returns A clone of this Trace.
     */
    clone(): Trace {
        let points = []; for (const point of this._points) { points.push(point.clone()); }
        let clone = new Trace(points, this._parentRobot, this._robotPart, this.times(), this._density, this._axisSize, this._traceSize, this._timespan ,this._color, this._rotations, this._trace_type);
        clone.setVisible(this._is_visible);
        clone._color = this._color;
        return clone;
    }
}