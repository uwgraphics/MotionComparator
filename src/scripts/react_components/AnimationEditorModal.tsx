import React, { Component, createRef, ReactElement } from "react";
import { Animation } from "../Animation";
import { AnimationGroup } from "../AnimationGroup";
import { AnimationManager } from "../AnimationManager";
import { AnimationTable } from "../AnimationTable";
import { enumerate, onlyNumbersFilter } from "../helpers";
import { RobotSceneManager } from "../RobotSceneManager";
import { RobotScene } from "../scene/RobotScene";
import { LabeledTextInput } from "./LabeledTextInput";

export interface animation_editor_modal_props {
    robotSceneManager: RobotSceneManager,
    animationManager: AnimationManager,
    robotScene: RobotScene
}

interface animation_editor_modal_state {
    updateCnt: number,
}

export class AnimationEditor extends Component<animation_editor_modal_props, animation_editor_modal_state> {
    constructor(props:animation_editor_modal_props) {
        super(props);

        this.onAddGroup = this.onAddGroup.bind(this);

        this.state = {
            updateCnt: 0,
        }
    }

    /**
     * Makes this Component check for UI updates.
     */
    update() {
        this.setState({ updateCnt: (this.state.updateCnt + 1) % 1000000 });
    }

    onAddGroup() {
        this.props.animationManager.addStoredAnimation(
            new AnimationGroup()
        );
        this.update();
    }

    render() {
        const robotAnimationGroupEditors:ReactElement<RobotAnimationGroupEditor>[] = [];

        for (const [i, group] of enumerate(this.props.animationManager.animationGroups())) {
            robotAnimationGroupEditors.push(
                <RobotAnimationGroupEditor
                    animationTables={this.props.robotSceneManager.animationTables()}
                    animationManager={this.props.animationManager}
                    robotScene={this.props.robotScene}
                    animationGroup={group}
                    key={`Group ${i}`}
                />
            );
        }
        
        let robots = this.props.robotScene.robots();
        let animationTables = this.props.robotSceneManager.animationTables();
        let animationGroups = this.props.animationManager.animationGroups();

        let errorMessage:string = "";
        const errorMessageStart = "This tab is used to bind animations to objects. You can not do this at a moment because ";

        if (robots.length === 0) {
            errorMessage = errorMessageStart + "you need to load in at least one object before you can bind an animation to it."
        } else if (animationTables.length === 0) {
            errorMessage = errorMessageStart + "you need to load in at least one animation before you can bind it to an object."
        } else if (animationGroups.length === 0) {
            this.onAddGroup();
        }

        return (
            <div className="AnimationEditor">
                { errorMessage.length > 0 ?
                    <label>{errorMessage}</label>
                    :
                    <div>
                        <input type="button" value="New Animation Group" onClick={this.onAddGroup} />
                        {robotAnimationGroupEditors}
                    </div>
                }
            </div>
        );
    }
}


export interface robot_animation_group_editor_props {
    animationTables: ReadonlyArray<AnimationTable>,
    animationManager: AnimationManager,
    robotScene: RobotScene,
    animationGroup: AnimationGroup,
}

interface robot_animation_group_editor_state {
    updateCnt: number,
}

class RobotAnimationGroupEditor extends Component<robot_animation_group_editor_props, robot_animation_group_editor_state> {
    protected _robotSelector: React.RefObject<HTMLSelectElement>;
    protected _animationTableSelector: React.RefObject<HTMLSelectElement>;

    constructor(props:robot_animation_group_editor_props) {
        super(props);

        this.onGroupNameChange = this.onGroupNameChange.bind(this);
        this.onDeactivateGroup = this.onDeactivateGroup.bind(this);
        this.onActivateGroup = this.onActivateGroup.bind(this);

        this.onAssociateAnimation = this.onAssociateAnimation.bind(this);

        this._robotSelector = createRef();
        this._animationTableSelector = createRef();

        this.state = {
            updateCnt: 0,
        }
    }

    update() {
        this.setState({
            updateCnt: (this.state.updateCnt + 1) % 1000000,
        });
    }

    onGroupNameChange(newName:string) {
        this.props.animationGroup.setName(newName);
    }

    onDeactivateGroup() {
        this.props.animationManager.removeActiveAnimation(this.props.animationGroup);
        this.props.animationManager.addStoredAnimation(this.props.animationGroup);
    }

    onActivateGroup() {
        this.props.animationManager.storeAllGroups();
        this.props.animationManager.addActiveAnimation(this.props.animationGroup);
    }

    isActivated():boolean {
        let isActivated = false;
        for (const animGroup of this.props.animationManager.activeAnimations()) {
            if (this.props.animationGroup === animGroup) {
                isActivated = true;
                break;
            }
        }
        return isActivated;
    }

    onAssociateAnimation() {
        let robotSelector = this._robotSelector.current;
        let animationTableSelector = this._animationTableSelector.current;
        if (robotSelector && animationTableSelector) {
            const robotId = robotSelector.value;
            const atId = animationTableSelector.value;
            let _robot = null;
            let _at = null;

            for (const robot of this.props.robotScene.robots()) {
                if (robot.idValue() === robotId) {
                    _robot = robot;
                    break;
                }
            }

            for (const at of this.props.animationTables) {
                if (at.idValue() === atId) {
                    _at = at;
                    break;
                }
            }

            if (_robot && _at) {
                this.props.animationGroup.addAnimation(
                    new Animation(_robot, _at)
                );
            }
        }

        // Activate the group (because otherwise people forget to).
        if (this.props.animationManager.activeAnimations().indexOf(this.props.animationGroup) === -1) {
            // Activate the group
            this.props.animationManager.addActiveAnimation(this.props.animationGroup);
        }
    }

    render() {
        const robotAnimationEditors:ReactElement<RobotAnimationEditor>[] = [];

        for (const [i, anim] of enumerate(this.props.animationGroup.animations())) {
            robotAnimationEditors.push(
                <RobotAnimationEditor
                    animation={anim}
                    animationManager={this.props.animationManager}
                    onRemoveAnimation={(animation:Animation) => {
                        this.props.animationGroup.removeAnimation(animation);
                    }}
                    key={`Anim ${i}`}
                />
            );
        }

        const robotOptions:ReactElement<HTMLOptionElement>[] = [];
        for (const robot of this.props.robotScene.robots()) {
            robotOptions.push(
                <option key={robot.idValue()} value={robot.idValue()} >{robot.name()}</option>
            );
        }

        

        const animationTableOptions:ReactElement<HTMLOptionElement>[] = [];
        for (const at of this.props.animationTables) {
            animationTableOptions.push(
                <option key={at.idValue()} value={at.idValue()}>{at.name()}</option>
            );
        }

        return (
            <div className="RobotAnimationGroupEditor">
                <div className="header">
                    <input
                        type="button"
                        value="Delete Group"
                        onClick={() => {
                            this.props.animationManager.removeAnimationGroup(this.props.animationGroup);  
                        }}
                    />
                    <LabeledTextInput labelValue={"Group Name:"} value={this.props.animationGroup.name()} onChange={this.onGroupNameChange} />
                    { this.isActivated() ?
                        <input type="button" value="Deactivate" onClick={this.onDeactivateGroup} />
                        :
                        <input type="button" value="Activate" onClick={this.onActivateGroup} />
                    }
                    <select ref={this._robotSelector} name="Robots">
                        {robotOptions}
                    </select>

                    <select ref={this._animationTableSelector} name="AnimationTables">
                        {animationTableOptions}
                    </select>

                    <input
                        type="button"
                        value="Bind Animation"
                        onClick={this.onAssociateAnimation}
                    />
                </div>
                <div className="content">
                    { robotAnimationEditors }
                </div>
            </div>
        );
    }
}

export interface robot_animation_editor_props {
    animation: Animation,
    animationManager: AnimationManager,
    onRemoveAnimation: (animation:Animation) => void,
}

interface robot_animation_editor_state {

}

class RobotAnimationEditor extends Component<robot_animation_editor_props, robot_animation_editor_state> {
    constructor(props:robot_animation_editor_props) {
        super(props);

        this.removeAnimation = this.removeAnimation.bind(this);
    }

    removeAnimation() {
        this.props.onRemoveAnimation(this.props.animation);
    }

    render() {
        return (
            <div className="RobotAnimationEditor">
                <input type="button" value="Unbind Animation" onClick={this.removeAnimation} />
                <LabeledTextInput
                    labelValue="Offset:"
                    value={`${this.props.animation.offset()}`}
                    filter={onlyNumbersFilter}
                    onReturnPressed={(value:string) => {
                        let numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            this.props.animation.setOffset(numValue);
                        }
                    }}
                />
                <LabeledTextInput
                    labelValue="Lengthening:"
                    value={`${this.props.animation.lengthen()}`}
                    filter={onlyNumbersFilter}
                    onReturnPressed={(value:string) => {
                        let numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            this.props.animation.setLengthen(numValue);
                        }
                    }}
                />
                <label className="objectAnimatingLabel">{`${this.props.animation.objectAnimating().name()}:`}</label>
                <label className="animationTableLabel">{`${this.props.animation.animationTable().name()}`}</label>
            </div>
        );
    }
}