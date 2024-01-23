import React, { Component, createRef, ReactElement } from "react";
import { Animation } from "../Animation";
import { AnimationGroup } from "../AnimationGroup";
import { AnimationManager } from "../AnimationManager";
import { AnimationTable } from "../AnimationTable";
import { enumerate, onlyNumbersFilter } from "../helpers";
import { RobotSceneManager } from "../RobotSceneManager";
import { RobotScene } from "../scene/RobotScene";
import { LabeledTextInput } from "./LabeledTextInput";
import { Robot } from "../objects3D/Robot";

export interface animation_editor_modal_props {
    robotSceneManager: RobotSceneManager,
    animationManager: AnimationManager,
    robotScene: RobotScene,
    robot: Robot,
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

        let animation: Animation | undefined;
        for (const [i, group] of enumerate(this.props.animationManager.animationGroups())) {
            for (const [j, anim] of enumerate(group.animations())) {
               if(anim.robot() === this.props.robot)
               {
                    animation = anim;
               }
            }
        }
       
        return (
            <div className="AnimationEditor">
                { errorMessage.length > 0 ?
                    <label>{errorMessage}</label>
                    :
                    <div>
                        <LabeledTextInput
                    labelValue="Offset:"
                    value={`${animation?.offset()}`}
                    filter={onlyNumbersFilter}
                    onReturnPressed={(value:string) => {
                        let numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            animation?.setOffset(numValue);
                        }
                    }}
                />
                    </div>
                }
            </div>
        );
    }
}