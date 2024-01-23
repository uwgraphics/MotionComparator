import { Component, ReactElement, createRef } from "react";
import { log } from "../../helpers";
import { RobotScene } from "../../scene/RobotScene";
import { panel_props } from "./panel";
import { Robot } from "../../objects3D/Robot";
import { APP } from "../../constants";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { LabeledTextInput } from "../LabeledTextInput";

export interface robot_selector_panel_props extends panel_props {
    robotScene: RobotScene,
}

interface robot_selector_panel_state { }

/**
 * Panel for displaying general information about each robot in the scene and
 * allowing you to select one of them.
 */
export class RobotSelectorPanel extends Component<robot_selector_panel_props, robot_selector_panel_state> {
    render() {
        const panelProps = {}

        const robotPanels:ReactElement[] = [];
        this.props.robotScene.robots().forEach((robot) => {
            robotPanels.push(
                <RobotPanel
                    className={robot === this.props.robotScene.selectedRobot() ? "selectedRobot" : ""}
                    key={robot.idValue()}
                    robot={robot} {...panelProps}
                    robotScene={this.props.robotScene}
                />
            );
        });

        let title: null | JSX.Element = null;
        if (robotPanels.length === 0) {
            title = (
                <div>
                    <label>{ "This tab is used to select an object of the current scene, but there is no current scene. Use the \"Select Scene\" tab to select a scene and/or use the \"Load&Save\" tab to load in a scene to select." }</label>
                </div>
            );
        }

        return (
            <div className="RobotSelectorPanel">
                { title }
                {robotPanels}
            </div>
        );
    }
}


interface robot_panel_props extends panel_props{
    robotScene: RobotScene,
    robot: Robot,
    className?: string,
}

interface robot_panel_state {
}

/**
 * Displays a summary of the information for 1 Robot.
 */
class RobotPanel extends Component<robot_panel_props, robot_panel_state> {
    protected _classDiv: React.RefObject<HTMLDivElement>;

    constructor(props:robot_panel_props) {
        super(props);
        this._classDiv = createRef();

        this.onShowRobot = this.onShowRobot.bind(this);
        this.onShowEndEffector = this.onShowEndEffector.bind(this);
        this.onHoverable = this.onHoverable.bind(this);
        this.onOpacityChange = this.onOpacityChange.bind(this);
        this.onPanelClicked = this.onPanelClicked.bind(this);
    }

    onShowRobot(event:React.FormEvent<HTMLInputElement>) {
        this.props.robot.setVisible(event.currentTarget.checked);
        APP.updateUI();
    }

    onShowEndEffector(event:React.FormEvent<HTMLInputElement>) {
        APP.updateUI();
    }

    onHoverable(event:React.FormEvent<HTMLInputElement>) {
        APP.updateUI();
    }

    onOpacityChange(event:React.FormEvent<HTMLInputElement>) {
        let value = event.currentTarget.valueAsNumber;
        if (value) {
            this.props.robot.setOpacity(value);
            this.forceUpdate(); // forces rerender so that the label above the slider can update
        }
    }

    onPanelClicked(event:any) {
        // Only select this panel's robot if the panel's whitespace was clicked
        // i.e. when a div rather than something like a slider or button, is clicked
        let tagName:string | undefined = event.target.tagName;
        if (tagName) tagName = tagName.trim().toUpperCase();
        if (tagName === 'DIV' || tagName === "LABEL") {
            this.props.robotScene.setSelectedRobot(this.props.robot);
        }
    }

    componentDidMount() {
        let div = this._classDiv.current;
        if (div) {
            div.addEventListener("click", this.onPanelClicked);
        }
    }

    componentWillUnmount() {
        let div = this._classDiv.current;
        if (div) {
            div.removeEventListener("click", this.onPanelClicked);
        }
    }

    render() {
        let opacity = this.props.robot.opacity();

        let className = "RobotPanel"
        if (this.props.className) {
            className += " " + this.props.className;
        }

        return (
            <div className={className} ref={this._classDiv} >
                <LabeledTextInput
                    labelValue="Name:"
                    value={this.props.robot.name()}
                    onReturnPressed={(currValue) => {
                        this.props.robot.setName(currValue);
                    }}
                />
                <LabeledCheckBox label="Show Object" checked={this.props.robot.visible()} onChange={this.onShowRobot} />
                <div>
                    <div>
                        <label>Robot Opacity: { opacity }</label>
                    </div>
                    <div>
                        <input type="range" min={-0.01} step={0.01} max={1} value={opacity} onChange={this.onOpacityChange} />
                    </div>
                </div>
            </div>
        );
    }
}

