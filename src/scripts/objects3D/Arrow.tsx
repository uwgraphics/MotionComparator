import T  from "../true_three";
import { APP } from "../constants";
import { isMesh } from "../gaurds";
import { clamp, getDistanceLevels, lightenColor, randColor, recurseMaterialTraverse } from "../helpers";
import { RobotScene } from "../scene/RobotScene";
import { Robot } from "./Robot";
import { RobotJoint } from "./RobotJoint";
import { SubscribeArrayWithArg } from "../subscriptable/SubscribeArrayWithArg";
import { SubscriptableValue } from "../subscriptable/SubscriptableValue";
import { Trace } from "./Trace";
import { RobotLink } from "./RobotLink";
import { Id } from "../Id";
import * as d3 from "d3";

/**
 * Arrows that points from one path to another,
 * i.e an arrow points from one robot's position 
 * to another robot's position at time t
 */
export class Arrow {
    // protected _parentScene: SubscriptableValue<RobotScene | undefined>; // The scene that the Trace is in
    protected _parentScene: RobotScene | undefined;
    
    protected _currGeom: T.Object3D;
    protected _currGeomArray: T.Object3D [];
    protected _color: string;
    protected _is_visible: boolean;
    protected _opacity: number;

    protected _rootGroup: T.Group;

    protected _id: Id;
    
    // The reference Robot (arrows points from the path of this robot).
    protected _traceFrom: Trace;
    // The target Robot (arrows points to the path of this robot).
    protected _traceTo: Trace;

    protected _baseSceneTimeIndex: number[];

    constructor(traceFrom: Trace, traceTo: Trace, parentScene: RobotScene, color?: string) {
        this._id = new Id();
        this._color = randColor();
        if(color !== undefined)
            this._color = color;

        this._rootGroup = new T.Group();
        this._currGeom = this.newGeom();
        this._currGeomArray = [];
        this._baseSceneTimeIndex = [];
        this._rootGroup.add(this._currGeom);

        this._is_visible = true;

        this._traceFrom = traceFrom;
        this._traceTo = traceTo;

        this._opacity = 0.5;

        this._parentScene = undefined;
        // this._parentScene = new SubscriptableValue(undefined) as SubscriptableValue<RobotScene | undefined>;

        this.update(traceFrom, traceTo);

        let _this = new WeakRef(this); // weakref so that neither function holds onto this object.

        this.setParentScene(parentScene);
        
        // this._traceFrom.robot().afterParentSceneSet().subscribe((([, newParent]) => {
        //     let __this = _this.deref();
        //     if (__this === undefined) { return false; }

        //     if (newParent === undefined) {
        //         __this.setParentScene(undefined);
        //         return false;
        //     } else {
        //         __this.updatePointsFrom();
        //     }
        //     return true;
        // }))

        // this._traceFrom.robot().afterpositionOffsetSet().subscribe((() => {
        //     let __this = _this.deref();
        //     if (__this === undefined) { return false; }
        //     __this.updatePointsFrom();
        //     return true;
        // }));

        /*
        robotTo.afterParentSceneSet().subscribe((([, newParent]) => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }

            if (newParent === undefined) {
                __this.setParentScene(undefined);
                return false;
            } else {
                __this.updatePointsTo();
            }
            return true;
        }))

        robotTo.afterAbsolutePositionSet().subscribe((() => {
            let __this = _this.deref();
            if (__this === undefined) { return false; }
            __this.updatePointsTo();
            return true;
        }));*/
    }

    traceFrom(): Trace{
        return this._traceFrom;
    }
    traceTo(): Trace{
        return this._traceTo;
    }
    color(): string{
        return this._color;
    }
    id(): string{
        return this._id.value();
    }

    /**
     * update the difference according to the updated timespan of the two traces.
     * if they are time warped, use the timespan of the base trace.
     * The traces are guaranteed to be updated before their difference
     * @returns 
     */
    updateTimespan()
    {
        let traceFrom = this._traceFrom, traceTo = this._traceTo;
        let timespanIndex: number[] = [];
        if (traceFrom.robot().parentScene()?.baseSceneId() === traceTo.robot().parentScene()?.id().value()) {
            // the scene of the traceFrom is timewarped based on the scene of traceTo
            timespanIndex = traceTo.timespanIndex();
        }
        else
        {
            timespanIndex = traceFrom.timespanIndex();
        }
        // console.log(timespanIndex);
        if(timespanIndex.length !== 2) return;

        let geomIndex: number[] = [];
        for (let i = 0; i < this._baseSceneTimeIndex.length; i++) {
            if(this._baseSceneTimeIndex[i] >= timespanIndex[0])
            {
                geomIndex[0] = i;
                break;
            }
        }

        for (let i = this._baseSceneTimeIndex.length-1; i >= 0; i--) {
            if(this._baseSceneTimeIndex[i] <= timespanIndex[1])
            {
                geomIndex[1] = i;
                break;
            }
        }

        
        for (let i = 0; i < this._currGeomArray.length; i++) {
            if (this._currGeomArray[i] === undefined) continue;
            if (i < geomIndex[0] || i > geomIndex[1]) {
                this._currGeomArray[i].visible = false;
            }
            else
                this._currGeomArray[i].visible = true;
        }
        this.parentScene()?.render();
    }

    /**
     * create the difference between two traces
     * @param traceFrom 
     * @param traceTo 
     * @returns 
     */
    protected newGeom(traceFrom?: Trace, traceTo?: Trace): T.Object3D{
        this._currGeomArray = [];
        if(traceFrom === undefined || traceTo === undefined)
            return new T.Group();
        let pointsFrom = traceFrom.points(), pointsTo = traceTo.points();
        console.log("points length " + pointsFrom.length);
        if(pointsFrom.length !== pointsTo.length)
        {
            console.log("the number of points do not match!!!");
        }
        else
        {
            let distances: number[] = [];
            let arrows = new T.Group();
            let indices: [number[], number[]] = [[],[]];
            if (traceFrom.robot().parentScene()?.baseSceneId() === traceTo.robot().parentScene()?.id().value()) {
                // the scene of the traceFrom is timewarped based on the scene of traceTo
                let indices_map = traceFrom.robot().parentScene()?.timeWarping()?.indexMap();
                if (indices_map === undefined) return arrows;
                indices[0] = [...indices_map[1]];
                indices[1] = [...indices_map[0]];
                this._baseSceneTimeIndex = indices[1];
            }
            else if (traceTo.robot().parentScene()?.baseSceneId() === traceFrom.robot().parentScene()?.id().value()) {
                // the scene of the traceTo is timewarped based on the scene of traceFrom
                let indices_map = traceTo.robot().parentScene()?.timeWarping()?.indexMap();
                if (indices_map === undefined) return arrows;
                indices[0] = [...indices_map[0]];
                indices[1] = [...indices_map[1]];
                this._baseSceneTimeIndex = indices[0];
            }
            else // not time warped
            {
                for(let i=0; i<pointsFrom.length; i++)
                {
                    indices[0][i] = i;
                    indices[1][i] = i;
                }
                this._baseSceneTimeIndex = indices[0];
            }

            console.log(indices);

            for (let i = 0; i < indices[0].length; i++) {
                distances.push(pointsFrom[indices[0][i]].distanceTo(pointsTo[indices[1][i]]));
            }

            let max_distance = Math.max(...distances);
            let min_distance = Math.min(...distances);
            console.log("max " + max_distance + " min " + min_distance);
            for (let i = 0; i < indices[0].length - 1; i++) {
                const points = new Float32Array([
                    pointsFrom[indices[0][i]].x, pointsFrom[indices[0][i]].y, pointsFrom[indices[0][i]].z,
                    pointsTo[indices[1][i]].x, pointsTo[indices[1][i]].y, pointsTo[indices[1][i]].z,
                    pointsTo[indices[1][i+1]].x, pointsTo[indices[1][i+1]].y, pointsTo[indices[1][i+1]].z,
                    pointsFrom[indices[0][i]].x, pointsFrom[indices[0][i]].y, pointsFrom[indices[0][i]].z,
                    pointsTo[indices[1][i+1]].x, pointsTo[indices[1][i+1]].y, pointsTo[indices[1][i+1]].z,
                    pointsFrom[indices[0][i+1]].x, pointsFrom[indices[0][i+1]].y, pointsFrom[indices[0][i+1]].z,
                ]);
                const geometry = new T.BufferGeometry();
                // Add the points to the geometry
                geometry.setAttribute("position", new T.BufferAttribute(points, 3));

                // Compute face normals (optional, for shading)
                geometry.computeVertexNormals();

                // const lineGeom = new T.BufferGeometry().setFromPoints( points );
                let distance1 = pointsFrom[indices[0][i]].distanceTo(pointsTo[indices[1][i]]);
                let distance2 = pointsFrom[indices[0][i+1]].distanceTo(pointsTo[indices[1][i+1]]);
                //console.log("d1 "+ distance1 + " d2 " + distance2);

                // the smaller the distance, the lighter the color (close to white)
                let factor1 = (distance1 - min_distance) / (max_distance - min_distance);
                let factor2 = (distance2 - min_distance) / (max_distance - min_distance);

                let color1 = d3.rgb(d3.interpolateViridis(factor1));
                let color2 = d3.rgb(d3.interpolateViridis(factor2));
                const r1 = color1["r"] / 255.0;
                const g1 = color1["g"] / 255.0;
                const b1 = color1["b"] / 255.0;
                const r2 = color2["r"] / 255.0;
                const g2 = color2["g"] / 255.0;
                const b2 = color2["b"] / 255.0;

                const colors = new Float32Array([
                    r1, g1, b1,
                    r1, g1, b1,
                    r2, g2, b2,
                    r1, g1, b1,
                    r2, g2, b2,
                    r2, g2, b2,
                ]);

                geometry.setAttribute("color", new T.BufferAttribute(colors, 3));

                const surfaceMat = new T.MeshPhongMaterial({ vertexColors: true, side: T.DoubleSide });
                const surface = new T.Mesh(geometry, surfaceMat);
                arrows.add(surface);
                this._currGeomArray[i] = surface;
            }

            this.updateTimespan();
            return arrows;
        }

        return new T.Group();
    }
    // protected updatePointsFrom(): boolean {
    //     let robotFrom = this.robotFrom();
    //     let robotTo = this.robotTo();
    //     let robotScene = robotFrom.parentScene();
    //     if (robotScene) {
    //         // Can and should update Trace points
    //         let robotPartFrom = this.robotPartFrom();
    //         let newPointsFrom: T.Vector3[];
    //         if (robotPartFrom instanceof RobotJoint) {
    //             newPointsFrom = robotScene.frameDataFor(robotFrom, this.timesFrom(), robotPartFrom, true).jointPositions;
    //         } else if (robotPartFrom instanceof RobotLink) {
    //             newPointsFrom = robotScene.frameDataFor(robotFrom, this.timesFrom(), robotPartFrom, true).linkPositions;
    //         } else {
    //             throw new Error("Invalid robotPart type");
    //         }
    //         let robotPartTo = this.robotPartTo();
    //         let newPointsTo: T.Vector3[];
    //         if (robotPartTo instanceof RobotJoint) {
    //             newPointsTo = robotScene.frameDataFor(robotTo, this.timesTo(), robotPartTo, true).jointPositions;
    //         } else if (robotPartTo instanceof RobotLink) {
    //             newPointsTo = robotScene.frameDataFor(robotTo, this.timesTo(), robotPartTo, true).linkPositions;
    //         } else {
    //             throw new Error("Invalid robotPart type");
    //         }
    //         this.setPoints(newPointsFrom, newPointsTo);
    //     } else {
    //         return false;
    //     }
    //     return true;
    // }

    /*
    protected updatePointsTo(): boolean {
        let robot = this.robotTo();
        let robotScene = robot.parentScene();
        if (robotScene) {
            // Can and should update Trace points
            let robotPart = this.robotPartTo();
            let newPoints: T.Vector3[];
            if (typeof robotPart === "boolean") {
                newPoints = robotScene.frameDataFor(robot, this.timesTo(), robotPart, true).robotPositions;
            } else {
                newPoints = robotScene.frameDataFor(robot, this.timesTo(), robotPart, true).jointPositions;
            }
            this.setPoints(newPoints);
        } else {
            return false;
        }
        return true;
    }*/

    // beforeParentSceneSet(): SubscribeArrayWithArg<[RobotScene | undefined, RobotScene | undefined]> {
    //     return this._parentScene.beforeSet();
    // }

    // afterParentSceneSet(): SubscribeArrayWithArg<[RobotScene | undefined, RobotScene | undefined]> {
    //     return this._parentScene.afterSet();
    // }

    robotFrom(): Robot { return this._traceFrom.robot(); }
    robotPartFrom(): RobotJoint | RobotLink | undefined { return this._traceFrom.robotPart(); }
    timesFrom(): number[] { return this._traceFrom.times(); }
    robotTo(): Robot { return this._traceTo.robot(); }
    robotPartTo(): RobotJoint | RobotLink | undefined { return this._traceTo.robotPart(); }
    timesTo(): number[] { return this._traceTo.times(); }

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

    /**
     * @returns The trace's current parent RobotScene. This is the scene that
     * the Trace is actually displayed in.
     */
    parentScene(): RobotScene | undefined {
        // return this._parentScene.value();
        return this._parentScene;
    }

    /**
     * @param pointsFrom The points for the arrows points from.
     * @param pointsTo The points for the arrows points to.
     * @returns The ThreeObject that form the arrows between two paths
     */
    // protected newGeom(pointsFrom: readonly T.Vector3[] | undefined=undefined, pointsTo: readonly T.Vector3[] | undefined=undefined): T.Object3D {
    //     if (pointsFrom === undefined) {
    //         pointsFrom = [];
    //     }
    //     if (pointsTo === undefined) {
    //         pointsTo = [];
    //     }
    //     if(pointsFrom.length !== pointsTo.length)
    //     {
    //         console.log("the number of points do not match!!!");
    //     }
    //     else
    //     {
    //         let arrows = new T.Group();
    //         for (let i = 0; i < pointsFrom.length; i++) {
    //             const points = [];
    //             points.push(pointsFrom[i]);
    //             points.push(pointsTo[i]);
    //             const lineGeom = new T.BufferGeometry().setFromPoints( points );
    //             const lineMat = new T.LineBasicMaterial({ color: this._color });
    //             const line = new T.Line(lineGeom, lineMat);
    //             arrows.add(line);
    //         }
    //         return arrows;
    //     }

    //     return new T.Group();
    // }

    /**
     * @param newParentScene The new parent scene of this Trace.
     */
    setParentScene(newParentScene: RobotScene | undefined) {
        console.log("set parent scene!!!");
        if (newParentScene === this._parentScene) { return; }

        if(this._parentScene !== undefined)
        {
            this._parentScene.scene().remove(this._rootGroup);
            this._parentScene.render();
        }
        this._parentScene = newParentScene;
        if(newParentScene !== undefined)
        {
            newParentScene.scene().add(this._rootGroup);
            newParentScene.render();
        }
        // this._parentScene.setValue(
        //     (oldScene, _) => {
        //         // Remove this trace from its current scene
        //         if (oldScene) {
        //             oldScene.scene().remove(this._rootGroup);
        //             oldScene.render();
        //         }
        //     },
        //     newParentScene,
        //     (_, newScene) => {
        //         // Add it to its new scene
        //         if (newScene !== undefined) {
        //             newScene.scene().add(this._rootGroup);
        //             newScene.render();
        //         }
        //     }
        // )
        APP.updateUI();
    }

    /**
     * Returns the points that the arrows points from.
     * @returns The points that the arrows points from.
     */
    pointsFrom(): ReadonlyArray<T.Vector3> {
        return this._traceFrom.points();
    }

    /**
     * Returns the points that the arrows points to.
     * @returns The points that the arrows points to.
     */
    pointsTo(): ReadonlyArray<T.Vector3> {
        return this._traceTo.points();
    }

    /**
     * Clones this Trace's points and returns the cloned list of vectors.
     */
    /*
    clonedPoints(): T.Vector3[] {
        return this._points.map((v) => { return v.clone(); })
    }*/
    
    /**
     * Updates the Arrow so that it has the given args.
     */
    update(traceFrom: Trace, traceTo: Trace) {

        // Create the new geometry
        let line = this.newGeom(traceFrom, traceTo);

        // Remove the old geometry
        this._rootGroup.remove(this._currGeom);

        this._currGeom = line;

        this._rootGroup.add(this._currGeom);
    }

    /**
     * Note: The clone does not possess any controlled clones. It is just a
     * clone of the trace itself.
     * @returns A clone of this Trace.
     */
    /*
    clone(): Arrow {
        let points = []; for (const point of this._points) { points.push(point.clone()); }
        let clone = new Arrow(points, this._parentRobot, this._robotPart, this.times());
        clone.setVisible(this._is_visible);
        clone._color = this._color;
        return clone;
    }*/
}