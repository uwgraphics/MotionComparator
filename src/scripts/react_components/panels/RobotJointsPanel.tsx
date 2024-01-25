import { Component } from "react";
import { LabeledSlider } from "../LabeledSlider";
import { degsToRads, radsToDegs } from "../../helpers";
import { Robot } from "../../objects3D/Robot";
import { RobotScene } from "../../scene/RobotScene";
import { panel_props } from "./panel";
import { RobotJoint } from '../../objects3D/RobotJoint';
import T from "../../true_three";
import Switch from '@mui/material/Switch';

export interface robot_joints_panel_props extends panel_props {
    robotScene:RobotScene, // mainly used for telling it to rerender
    robot:Robot,
}

interface robot_joints_panel_state {
    rotationType: "Euler" | "Quaternion",
    angleType: "Radian" | "Degree",
}

/**
 * Panel for displaying all the joints/placement/size of a single robot
 */
export class RobotJointsPanel extends Component<robot_joints_panel_props, robot_joints_panel_state> {
    constructor(props:robot_joints_panel_props) {
        super(props);
        this.jointAngleCallbackGen = this.jointAngleCallbackGen.bind(this);
        this.onSizeChange = this.onSizeChange.bind(this);
        this.positionCallbackGen = this.positionCallbackGen.bind(this);
        this.toggleRotType = this.toggleRotType.bind(this);
        this.toggleAngleType = this.toggleAngleType.bind(this);

        this.state = {
            rotationType: "Euler",
            angleType: "Degree",
        }
    }

    toggleRotType() {
        this.setState({
            rotationType: this.state.rotationType === "Quaternion" ? "Euler" : "Quaternion",
        });
    }

    toggleAngleType() {
        this.setState({
            angleType: this.state.angleType === "Degree" ? "Radian" : "Degree",
        });
    }

    onSizeChange(absolute:boolean):(newValue:number) => void {
        return (newValue:number) => {
            if (absolute)  {
                this.props.robot.setScaleOffset(new T.Vector3(newValue, newValue, newValue));
            } else {
                this.props.robot.setScale(new T.Vector3(newValue, newValue, newValue));
            }
            this.props.robotScene.render();
        }
    }

    positionCallbackGen(position: string | "x" | "y" | "z", absolute:boolean):((newValue:number) => void) {
        if (position !== "x" && position !== "y" && position !== "z") {
            console.error(`Postion "${position}" is not one of "x", "y", "z"!`);
            position = "x";
        }
        return (newValue:number) => {
            let robot = this.props.robot;
            let pos:T.Vector3;
            if (absolute) {
                pos = robot.getPositionOffset();
            } else {
                pos = robot.getPosition();
            }
            let [x, y, z] = [pos.x, pos.y, pos.z];

            if (position === "x") {
                x = newValue;
            } else if (position === "y") {
                y = newValue;
            } else if (position === "z") {
                z = newValue;
            }
            if (absolute) {
                robot.setPositionOffset(new T.Vector3(x, y, z));
            } else {
                robot.setPosition(new T.Vector3(x, y, z));
            }
        }
    }

    rotationCallbackGen(axis: "x" | "y" | "z" | "w", absolute:boolean, rotType:"Euler" | "Quaternion", angleType:"Degree" | "Radian"):((newValue:number) => void) {
        if (axis !== "x" && axis !== "y" && axis !== "z" && axis !== "w") {
            console.error(`Rotation axis "${axis}" is not one of ["x", "y", "z", "w"]!`);
            axis = "x";
        }
        return (newValue:number) => {
            let robot = this.props.robot;
            let rot:T.Quaternion;
            if (absolute) {
                rot = robot.getQuaternionOffset().clone();
            } else {
                rot = robot.getQuaternion().clone();
            }

            if (rotType === "Euler") {
                let eRot = this.props.robot.eulerRotation();
                // let eRot = new T.Euler().setFromQuaternion(rot);

                console.log("before");
                console.log(eRot);
                console.log(rot);
                //console.log(`${axis}: ${newValue} = ${degsToRads(newValue)}`);
                if(angleType === "Degree")
                    newValue = degsToRads(newValue);

                if (axis === "x") {
                    eRot.x = newValue;
                } else if (axis === "y") {
                    eRot.y = newValue;
                } else if (axis === "z") {
                    eRot.z = newValue;
                } else if (axis === "w") {
                    return; // Euler's don't have a W
                }

                rot.setFromEuler(eRot);
                console.log("after");
                console.log(eRot);
                console.log(rot);

            } else if (rotType === "Quaternion") {

                if (axis === "x") {
                    rot.x = newValue;
                } else if (axis === "y") {
                    rot.y = newValue;
                } else if (axis === "z") {
                    rot.z = newValue;
                } else if (axis === "w") {
                    rot.w = newValue;
                }
            }
            
            if (absolute) {
                robot.setQuaternionOffset(rot);
            } else {
                robot.setQuaternion(rot);
            }
        }
    }

    /**
     * Generates callback for making the joint move.
     * @param joint The joint that should be moved/rotated when this callback is called.
     * @returns The callback for moving/rotating the joint.
     */
    jointAngleCallbackGen(joint:RobotJoint, angleType:"Degree" | "Radian"):((newValue:number) => void) {
        return (newValue:number) => {
            if(angleType === "Degree")
                joint.setAngle(degsToRads(newValue));
            else
                joint.setAngle(newValue);
        };
    }

    render() {
        //const panelProps = { updateUI:this.props.updateUI }
        const rotType = this.state.rotationType;
        const angleType = this.state.angleType;

        let sliders:JSX.Element[] = [];
        let robot = this.props.robot;
        let robotId = robot.idValue();

        let makeBaseSliders = (absolute:boolean) => {

            // Add Scale slider
            let scale:T.Vector3 = absolute ? robot.getScaleOffset() : robot.getScale();
            sliders.push(
                <LabeledSlider
                        label={`${absolute ? "" : "Relative "}Scale`}
                        min={0}
                        max={2}
                        step={0.001}
                        value={scale.x}
                        onChange={this.onSizeChange(absolute)}
                        key={`${robotId} ${absolute ? `Absolute` : `Relative`} Scale`}
                />
            );

            // Add Position sliders
            for (const v of ["x", "y", "z"]) {
                let pos:T.Vector3;
                if (absolute) {
                    pos = robot.getPositionOffset();
                } else {
                    pos = robot.getPosition();
                }

                let value;
                if (v === "x") {
                    value = pos.x;
                } else if (v === "y") {
                    value = pos.y;
                } else if (v === "z") {
                    value = pos.z;
                }
                sliders.push(
                    <LabeledSlider
                            label={`${absolute ? "" : "Relative "}Position ${v.toUpperCase()}`}
                            value={value}
                            min={-3}
                            max={3}
                            step={0.001}
                            onChange={this.positionCallbackGen(v, absolute)}
                            key={`${robotId} ${absolute ? `Absolute` : `Relative`} ${v} Position`}
                    />
                );
            }

            let step = 0.001;
            // Add Rotation Sliders
            for (const v of ["x", "y", "z", "w"]) {
                let axis: "x" | "y" | "z" | "w" = v as "x" | "y" | "z" | "w";
                let value:number = 0;
                let rot:T.Quaternion;
                let upperBound:number = 1;
                let lowerBound:number = -1;

                if (absolute) {
                    rot = robot.getQuaternionOffset();
                } else {
                    rot = robot.getQuaternion();
                }

                if (rotType === "Euler") {
                    let eRot = this.props.robot.eulerRotation();
                    // let eRot = new T.Euler().setFromQuaternion(rot);

                    if (axis === "x") {
                        value = eRot.x;
                    } else if (axis === "y") {
                        value = eRot.y;
                    } else if (axis === "z") {
                        value = eRot.z;
                    } else if (axis === "w") {
                        continue; // No W in Euler rotation
                    } else {
                        console.error(`Unknown axis "${axis}"`);
                        continue;
                    }

                    if(angleType === "Degree")
                    {
                        value = radsToDegs(value);
                        upperBound = 360;
                        lowerBound = -360;
                    }
                    else
                    {
                        upperBound = Math.PI * 2;
                        lowerBound = -Math.PI * 2;
                        step = Math.PI / 180 * 0.001;
                    }
                    

                } else if (rotType === "Quaternion") {

                    if (axis === "x") {
                        value = rot.x;
                    } else if (axis === "y") {
                        value = rot.y;
                    } else if (axis === "z") {
                        value = rot.z;
                    } else if (axis === "w") {
                        value = rot.w;
                    } else {
                        console.error(`Unknown axis "${axis}"`);
                        continue;
                    }
                }
                sliders.push(
                    <LabeledSlider
                            label={`${absolute ? "" : "Relative "}Rotation ${axis.toUpperCase()}`}
                            value={value}
                            min={lowerBound}
                            max={upperBound}
                            step={step}
                            onChange={this.rotationCallbackGen(axis, absolute, rotType, angleType)}
                            key={`${robotId} ${absolute ? `Absolute` : `Relative`} ${v} Rotation`}
                    />
                );
            }
        }

        makeBaseSliders(true);
        // makeBaseSliders(false);

        // Add joint sliders
        for (const [name, joint] of this.props.robot.getArticuatedJointMap()) {
            let min = joint.minAngle(), max = joint.maxAngle(), value = joint.angle(), step = Math.PI / 180 * 0.001;
            if(angleType === "Degree")
            {
                min = radsToDegs(min);
                max = radsToDegs(max);
                value = radsToDegs(value);
                step = 0.001;
            }
            sliders.push(
                <LabeledSlider
                        label={"Joint " + name}
                        min={min}
                        max={max}
                        value={value}
                        step={step}
                        onChange={this.jointAngleCallbackGen(joint, angleType)}
                        key={`${joint.idValue()} Rotation`}
                />
            );
        }

        return (
            <div className = "RobotJointsPanel">
                <div>
                    <div className="row-container">
                        <label>Rotations</label>
                        <label className="switch-left-label"> Euler</label>
                        <Switch
                            checked={this.state.rotationType === "Euler"}
                            onChange={this.toggleRotType}
                        />
                        <label className="switch-right-label"> Quaternion </label>
                    </div>
                    <div className="row-container">
                        <label>Unit</label>
                        <label className="switch-left-label"> Degree</label>
                        <Switch
                            checked={this.state.angleType === "Degree"}
                            onChange={this.toggleAngleType}
                        />
                        <label className="switch-right-label"> Radian </label>
                    </div>
                </div>
                <div>
                    {sliders}
                </div>
            </div>
        );
    }
}