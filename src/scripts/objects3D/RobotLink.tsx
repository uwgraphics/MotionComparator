import { Quaternion, Vector3 } from "three";
import { clamp } from "three/src/math/MathUtils";
import { URDFLink } from "urdf-loader";
import { APP } from "../constants";
import { Id } from "../Id";
import { Robot } from "./Robot";
import T from "../true_three";

/**
 * Wrapper around a Robot's link
 */
export class RobotLink {
    protected _id: Id;
    protected _robot: Robot; // parent Robot object to whom this link belongs.
    protected _link: URDFLink;
    protected _axisHelper: T.AxesHelper;
    protected _render: () => void; // callback for notifying the Robot that it was changed so it needs to rerender

    protected _includePosInTimeWarpConsideration: boolean;

    protected _sceneCounter: number; // the number of scenes the trace of this robotlink is in
    protected _graphCounter: number; // the number of graphs this robotlink is in

    /**
     * @param robot The parent Robot object to whom this link belongs.
     * @param link The URDFLink that is being manipulated.
     */
    constructor(robot:Robot, link:URDFLink, render:() => void) {
        this._id = new Id();
        this._robot = robot;
        this._link = link;

        
        this._axisHelper = new T.AxesHelper(0.1);
        this._axisHelper.visible = false;
        this._link.add(this._axisHelper)

        this._render = render;

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
        this._link.remove(this._axisHelper);
        this._axisHelper = new T.AxesHelper(size);
        this._link.add(this._axisHelper);
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
        return this._link.name;
    }

    /**
     * @returns the quaternion of this RobotLink in the world coordinate
     */
    getWorldQuaternion(): Quaternion {
        return this._link.getWorldQuaternion(new Quaternion());
    }

    getWorldPosition(): Vector3 {
        return this._link.getWorldPosition(new Vector3());
    }

    getLinkName(): string {
        return this._link.name;
    }
}