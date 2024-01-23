import T  from "../true_three";
import { APP } from "../constants";
import { isMesh } from "../gaurds";
import { clamp, findLargestSmallerElement, getEndPointFromQuaternion, randColor, recurseMaterialTraverse } from "../helpers";
import { RobotScene } from "../scene/RobotScene";
import { Robot } from "./Robot";
import { RobotJoint } from "./RobotJoint";
import { RobotLink } from "./RobotLink";
import { SubscribeArrayWithArg } from "../subscriptable/SubscribeArrayWithArg";
import { SubscriptableValue } from "../subscriptable/SubscriptableValue";
import { QuaternionSpaceScene } from "../scene/QuaternionSpaceScene";
import { Object3D, Quaternion, Vector3 } from "three";

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
 * Quaternion trace is a line shown the scene
 * tracing the path of a part of an object.
 */
export class QuaternionTrace {
    protected _parentScene: SubscriptableValue<QuaternionSpaceScene | undefined>; // The scene that the Trace is in
    protected _quaternions: T.Quaternion[];


    // traces under default setting
    protected _currGeom: T.Object3D; // the orignal trace geometry i.e. cones
    protected _currGeomArray: T.Object3D[];
    protected _currQuaternionGeom: T.Object3D // the symbol (a sphere) to indicate the position under the current time
    protected _vectors: T.Vector3[]; // store the vectors of the final traces
    

    // traces under the other setting (flip the default one)
    protected _currGeom2: T.Object3D; // the orignal trace geometry i.e. cones
    protected _currGeomArray2: T.Object3D[];
    protected _currQuaternionGeom2: T.Object3D // the symbol (a sphere) to indicate the position under the current time
    protected _vectors2: T.Vector3[]; // store the vectors of the final traces

    protected _positive: boolean; // positive is the default trace

    protected _color: string;
    protected _is_visible: boolean;
    protected _opacity: number;

    protected _rootGroup: T.Group;

    protected _trace_type: TRACETYPE;

    // The Robot that the Trace is tracing.
    protected _parentRobot: Robot;
    protected _robotPart:  RobotJoint | RobotLink | undefined;
    protected _times: number[];

    protected _timespan: number[]; // store the value of the curremt timespan
    protected _timespanIndex: number[]; // store the index of the timespan index in their orignal _times array
    protected _currTime: number;

    

    constructor(
            points: T.Quaternion[],
            robot: Robot,
            robotPart: RobotJoint | RobotLink | undefined,
            times: number[],
            timespan: number[],
            currTime: number,
            color?: string,
            traceType: TRACETYPE = defaultTraceBase,
    ) {
        if(color === undefined)
            this._color = randColor();
        else
            this._color = color;
        this._trace_type = defaultTraceBase;

        this._timespan = timespan;
        this._timespanIndex = [];
        
        this._currTime = currTime;
        // console.log(this._timespanIndices);


        this._positive = true;
        this._currGeomArray = [];
        this._rootGroup = new T.Group();
        this._currGeom = this.newGeom(undefined, true);
        this._rootGroup.add(this._currGeom);
        this._currQuaternionGeom = this.newSymbolGeom();
        this._rootGroup.add(this._currQuaternionGeom);

        this._currGeomArray2 = [];
        this._currGeom2 = this.newGeom(undefined, false);
        this._rootGroup.add(this._currGeom2);
        this._currQuaternionGeom2 = this.newSymbolGeom();
        this._rootGroup.add(this._currQuaternionGeom2);

        this._is_visible = true;

        this._quaternions = [];
        this._parentRobot = robot;
        this._robotPart = robotPart;
        this._times = times;
        this._opacity = 1;

        this._vectors = [];
        this._vectors2 = [];
        
        this._parentScene = new SubscriptableValue(undefined) as SubscriptableValue<QuaternionSpaceScene | undefined>;
        this.update(points, robot, robotPart, times, traceType, currTime);
        

        let _this = new WeakRef(this); // weakref so that neither function holds onto this object.

        robot.afterParentSceneSet().subscribe((([, newParent]) => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }

            if (newParent === undefined) {
                __this.setParentScene(undefined);
                return false;
            } else {
                __this.updateQuaternions();
            }
            return true;
        }))

        robot.afterpositionOffsetSet().subscribe((() => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }
            __this.updateQuaternions();
            return true;
        }));
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
        
        for(let i=0; i<this._currGeomArray.length; i++)
        {
            if(this._currGeomArray[i] === undefined) continue;
            if(i < startIndex || i > endIndex)
            {
                this._currGeomArray[i].visible = false;
            }
                
            else
                this._currGeomArray[i].visible = true;
        }

        for(let i=0; i<this._currGeomArray2.length; i++)
        {
            if(this._currGeomArray2[i] === undefined) continue;
            if(i < startIndex || i > endIndex)
            {
                this._currGeomArray2[i].visible = false;
            }
                
            else
                this._currGeomArray2[i].visible = true;
        }

        this.parentScene()?.render();
    }

    protected updateQuaternions(): boolean {
        let robot = this.robot();
        let robotScene = robot.parentScene();
        if (robotScene) {
            // Can and should update Trace points
            let robotPart = this.robotPart();
            let newPoints: T.Quaternion[];
            if (robotPart instanceof RobotJoint) {
                newPoints = robotScene.frameDataFor(robot, this.times(), robotPart, true).jointRotations;
            } else if (robotPart instanceof RobotLink) {
                newPoints = robotScene.frameDataFor(robot, this.times(), robotPart, true).linkRotations;
            } else {
                throw new Error("Invalid robotPart type");
            }
            this.setQuaternions(newPoints);
            this.updateSymbolGeom(this._currTime);
        } else {
            return false;
        }
        return true;
    }

    beforeParentSceneSet(): SubscribeArrayWithArg<[QuaternionSpaceScene | undefined, QuaternionSpaceScene | undefined]> {
        return this._parentScene.beforeSet();
    }

    afterParentSceneSet(): SubscribeArrayWithArg<[QuaternionSpaceScene | undefined, QuaternionSpaceScene | undefined]> {
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
    parentScene(): QuaternionSpaceScene | undefined {
        return this._parentScene.value();
    }

    setTraceType(newTraceType: TRACETYPE) {
        this.update(this._quaternions, this._parentRobot, this._robotPart, this.times(), newTraceType);
    }

    traceType(): TRACETYPE {
        return this._trace_type;
    }

    /**
     * calculate the current rotation of the object based on the current time
     * @param currTime 
     * @returns 
     */
    protected calCurrQuaternion(currTime: number): T.Quaternion | undefined
    {
        let robot = this.robot();
        let robotScene = robot.parentScene();
        if (robotScene) {
            // Can and should update Trace points
            let robotPart = this.robotPart();
            let currRotation: Map<undefined | RobotJoint | RobotLink, T.Quaternion[]> = QuaternionSpaceScene.extraceDataFromframeData(robotScene, robot, [currTime], robotPart);
            let quaternions = currRotation.get(robotPart);
            if(quaternions === undefined) return;
            let quaternion = quaternions[0];
            return quaternion;
        }
    }
    /**
     * create symbol that shows the object current rotation
     * Note: we only need to create it once and change its position
     * as it moves
     * @param quaternion 
     * @returns 
     */
    protected newSymbolGeom(): T.Object3D
    {
        let sphereGeom = new T.SphereGeometry(0.01);
        let sphereMesh = new T.MeshBasicMaterial({
            color: "red"
        });
        let sphere = new T.Mesh(sphereGeom, sphereMesh);
        return sphere;
    }

    /**
     * update the symbol as it moves
     * @param quaternion 
     */
    updateSymbolGeom(currTime: number)
    {
        // let quaternion = this.calCurrQuaternion(currTime);
        // if(quaternion === undefined) return;
        let index = findLargestSmallerElement(this._times, currTime);
        let point: T.Vector3, point2: T.Vector3;
        let quaternion = this._quaternions[0]
        if(index === -1) {
            point = getEndPointFromQuaternion(quaternion, undefined, true);
            point2 = getEndPointFromQuaternion(quaternion, undefined, false);
        }
        else
        {
            let prevQ = this._quaternions[index], nexQ = this._quaternions[index];
            let prevT = this._times[index], nextT = this._times[index];
            if(index+1 < this._quaternions.length)
            {
                nexQ = this._quaternions[index+1];
                nextT = this._times[index+1];
            }
            quaternion = prevQ.slerp(nexQ, (currTime - prevT) / (nextT - prevT));
            point = getEndPointFromQuaternion(quaternion, this._vectors[index], true);
            point2 = getEndPointFromQuaternion(quaternion, this._vectors2[index], false);
        }
        
        this._currQuaternionGeom.position.copy(point);
        this._currQuaternionGeom2.position.copy(point2);
        this.parentScene()?.render();
        this._currTime = currTime;
    }

    /**
     * @param points The points for the trace to trace through.
     * @returns The ThreeObject that goes through all the given points.
     */
    protected newGeom(quaternions: T.Quaternion[] | undefined=undefined, positive: boolean, traceType: TRACETYPE=defaultTraceBase, ): T.Object3D {
        if (quaternions === undefined) {
            quaternions = [];
        }

        // Need at least 2 points to trace through
        if (quaternions.length === 0) { quaternions.push(new T.Quaternion(), new T.Quaternion()); }
        else if (quaternions.length === 1) { quaternions.push(quaternions[0].clone()); }

        let points: Vector3[] = [];
        let pre_vector: Vector3 | undefined = undefined
        for(const quaternion of quaternions) {
            let v = getEndPointFromQuaternion(quaternion, pre_vector, positive);
            points.push(v);
            pre_vector = v;
        }
        if(positive) this._vectors = points;
        else this._vectors2 = points;
        const lineCurve = new T.CatmullRomCurve3(points, false);

        if (traceType === TRACETYPE.LINE) {
            const lineGeom = new T.BufferGeometry().setFromPoints(lineCurve.getPoints(points.length));
            const lineMat = new T.LineBasicMaterial({ color: new T.Color(this._color).convertSRGBToLinear()});
            return new T.Line(lineGeom, lineMat);

        } else if (traceType === TRACETYPE.TUBE) {
            const geometry = new T.TubeGeometry( lineCurve, points.length * 2, 0.005, 8, true );
            const material = new T.MeshBasicMaterial( { color: new T.Color(this._color).convertSRGBToLinear() } );
            return new T.Mesh( geometry, material );

        } else if (traceType === TRACETYPE.CONE) {
            let coneLine = new T.Group();
            const rotationMatrix = new T.Matrix4();
            const material = new T.MeshBasicMaterial( { color: new T.Color(this._color).convertSRGBToLinear() } );
            let currGeomArray = [];
            for (let i = 0; i < (points.length - 1); i++) {
                const currPt = points[i];
                const nextPt = points[i + 1];
                
                const dist = currPt.distanceTo(nextPt);
                // skip the drawing if the distance is large (we can cut the traces into several sub traces)
                if (dist === 0 || dist >= 1) { continue; }
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
                currGeomArray[i] = cone;
            }
            if(positive) this._currGeomArray = currGeomArray;
            else this._currGeomArray2 = currGeomArray;
            this.updateTimespan(this._timespan);
            return coneLine;
        } else {
            throw new Error(`Unknown LineTraceType "${traceType}"`);
        }
    }


    /**
     * @param newParentScene The new parent scene of this Trace.
     */
    setParentScene(newParentScene: QuaternionSpaceScene | undefined) {
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
    quaternions(): ReadonlyArray<T.Quaternion> {
        return this._quaternions;
    }

    /**
     * Clones this Trace's points and returns the cloned list of vectors.
     */
    clonedQuaternions(): T.Quaternion[] {
        return this._quaternions.map((v) => { return v.clone(); })
    }

    /**
     * Sets this trace to go through the given points.
     * @param newPoints The new points that this Trace should have.
     */
    setQuaternions(newPoints: T.Quaternion[]) {
        this.update(newPoints, this._parentRobot, this._robotPart, this.times(), this._trace_type);
    }


    // flip the trace
    flipTrace(){
        if(this._positive){
            this._currGeom.visible = false;
            this._currQuaternionGeom.visible = false;
            this._currGeom2.visible = true;
            this._currQuaternionGeom2.visible = true;
        }else{
            this._currGeom.visible = true;
            this._currQuaternionGeom.visible = true;
            this._currGeom2.visible = false;
            this._currQuaternionGeom2.visible = false;
        }
        this._positive = !this._positive;
        this.parentScene()?.render();
    }
    
    /**
     * Updates the Trace so that it has the given args.
     */
    update(
            newQuaternions: T.Quaternion[],
            robot: Robot,
            robotPart: RobotJoint | RobotLink | undefined,
            times: number[],
            traceType: TRACETYPE=defaultTraceBase,
            currTime?: number,
    ) {
        this._quaternions = newQuaternions;
        this._parentRobot = robot;
        this._robotPart = robotPart;
        this._times = times;

        // Create the new geometry
        let line = this.newGeom(newQuaternions, true, traceType);
        let line2 = this.newGeom(newQuaternions, false, traceType);

        if(currTime !== undefined)
            this.updateSymbolGeom(currTime);

        // Remove the old geometry
        this._rootGroup.remove(this._currGeom);
        this._rootGroup.remove(this._currGeom2);

        this._currGeom = line;
        this._currGeom2 = line2;

        if(this._positive){
            this._currGeom.visible = true;
            this._currQuaternionGeom.visible = true;
            this._currGeom2.visible = false;
            this._currQuaternionGeom2.visible = false;
        }else{
            this._currGeom.visible = false;
            this._currQuaternionGeom.visible = false;
            this._currGeom2.visible = true;
            this._currQuaternionGeom2.visible = true;
        }

        this._rootGroup.add(this._currGeom);
        this._rootGroup.add(this._currGeom2);

        this._trace_type = traceType;
    }
    
    /**
     * Note: The clone does not possess any controlled clones. It is just a
     * clone of the trace itself.
     * @returns A clone of this Trace.
     */
    clone(): QuaternionTrace {
        let quaternions = []; for (const point of this._quaternions) { quaternions.push(point.clone()); }
        let clone = new QuaternionTrace(quaternions, this._parentRobot, this._robotPart, this.times(), this._timespan, this._currTime,this._color, this._trace_type);
        clone.setVisible(this._is_visible);
        clone._color = this._color;
        return clone;
    }
}