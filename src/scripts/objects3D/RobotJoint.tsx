import { Quaternion, Vector3 } from "three";
import { clamp } from "three/src/math/MathUtils";
import { URDFJoint } from "urdf-loader";
import { APP } from "../constants";
import { Id } from "../Id";
import { Robot } from "./Robot";
import T from '../true_three';

/**
 * Wrapper around a Robot's joint so that it can tell it's owner Robot when it
 * has been changed.
 */
export class RobotJoint {
    protected _id: Id;
    protected _robot: Robot; // parent Robot object to whom this joint belongs.
    protected _joint: URDFJoint;
    protected _axisHelper: T.AxesHelper;
    protected _render: () => void; // callback for notifying the Robot that it was changed so it needs to rerender

    protected _includeAngleInTimeWarpConsideration: boolean;
    protected _includePosInTimeWarpConsideration: boolean;

    protected _sceneCounter: number; // the number of scenes the trace of this robotjoint is in
    protected _graphCounter: number; // the number of graphs this robotjoint is in

    /**
     * @param robot The parent Robot object to whom this joint belongs.
     * @param joint The URDFJoint that is being manipulated.
     */
    constructor(robot:Robot, joint:URDFJoint, render:() => void) {
        this._id = new Id();
        this._robot = robot;
        this._joint = joint;

        this._axisHelper = new T.AxesHelper(0.1);
        this._axisHelper.visible = false;
        this._joint.add(this._axisHelper)

        this._render = render;

        this._includeAngleInTimeWarpConsideration = false;
        this._includePosInTimeWarpConsideration = false;

        this._sceneCounter = 0;
        this._graphCounter = 0;
    }

    setAxisVisibility(visible: boolean){
        this._axisHelper.visible = visible;
        APP.updateUI();
        APP.render();
    }

    updateAxisSize(size: number){
        let visible = this._axisHelper.visible;
        this._joint.remove(this._axisHelper);
        this._axisHelper = new T.AxesHelper(size);
        this._joint.add(this._axisHelper);
        this._axisHelper.visible = visible;
        APP.updateUI();
        APP.render();
    }

    isInScene()
    {
        return this._sceneCounter !== 0;
    }
    isInGraph()
    {
        return this._graphCounter !== 0;
    }
    addToScene()
    {
        this._sceneCounter++;
    }

    removeFromScene()
    {
        if(this._sceneCounter > 0)
            this._sceneCounter--;
    }

    addToGraph()
    {
        this._graphCounter++;
    }

    removeFromGraph()
    {
        if(this._graphCounter > 0)
            this._graphCounter--;
    }

    includeAngleInTimeWarpConsideration(): boolean {
        return this._includeAngleInTimeWarpConsideration;
    }
    
    setAngleIncludeInTimeWarpConsideration(include: boolean) {
        this._includeAngleInTimeWarpConsideration = include;
        APP.updateUI();
        APP.render();
    }

    includePosInTimeWarpConsideration(): boolean {
        return this._includePosInTimeWarpConsideration;
    }
    
    setPosIncludeInTimeWarpConsideration(include: boolean) {
        this._includePosInTimeWarpConsideration = include;
        APP.updateUI();
        APP.render();
    }

    id(): Id {
        return this._id;
    }

    idValue(): string {
        return this._id.value();
    }

    name(): string {
        return this._joint.name;
    }

    type():string {
        return this._joint.type;
    }

    jointType():string {
        return this._joint.jointType;
    }

    /**
     * Returns the minimum angle that that this joint can be set to in radians.
     * @returns The minimum angle that that this joint can be set to in radians.
     */
    minAngle():number { 
        if (this.jointType() === "continuous") 
            return - 10 * Math.PI;
        else 
            return this._joint.limit.lower.valueOf();
    }
    
    /**
     * Returns the maximum angle that that this joint can be set to in radians.
     * @returns The maximum angle that that this joint can be set to in radians.
     */
    maxAngle():number {
        if (this.jointType() === "continuous")
            return 10 * Math.PI;
        else
            return this._joint.limit.upper.valueOf();
    }

    /**
     * Sets the new angle to the given angle.
     * @param newAngle The new angle in radians.
     */
    setAngle(newAngle:number) {
        newAngle = clamp(newAngle, this.minAngle(), this.maxAngle())
        this._joint.setJointValue(newAngle);
        this._render();
    }

    /**
     * Returns the current angle of this joint in radians.
     */
    angle():number {
        // Angle is of Number type but we want primitive number type so use
        // valueOf()
        return this._joint.angle.valueOf();
    }

    /**
     * @returns the quaternion of this RobotJoint in the world coordinate
     */
    getWorldQuaternion(): Quaternion {
        return this._joint.getWorldQuaternion(new Quaternion());
    }
    
    getWorldPosition(): Vector3 {
        return this._joint.getWorldPosition(new Vector3());
    }

    getJointName(): string {
        return this._joint.name;
    }
}