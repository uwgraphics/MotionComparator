import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { LabeledTextInput } from "../LabeledTextInput";
import { QuaternionSpaceScene } from "../../scene/QuaternionSpaceScene";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { Id } from "../../Id";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import Switch from '@mui/material/Switch';
import { ColorPicker } from "../ColorPicker";

export interface quaternion_panel_props {
    robotSceneManager: RobotSceneManager,
    currQuaternionSpaceScene: QuaternionSpaceScene | undefined
    getParentDockLayout: () => DockLayout | undefined,
    forceUpdateTabNames: () => void,
}

interface quaternion_panel_state {
    counter:number,
    update: boolean,
}

export class QuaternionSpaceOptionPanel extends Component<quaternion_panel_props, quaternion_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _quaternionDiv: React.RefObject<HTMLDivElement>;
   
    constructor(props: quaternion_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            update: false,
        };
        this._quaternionDiv = createRef();
    }

    componentDidUpdate(prevProps:quaternion_panel_props) {
    }

    onBackgroundColorChange(newValue: string) {
      // console.log(newValue);
      this.props.currQuaternionSpaceScene?.setBackgroundColor(newValue);
    }

    onLineGroupColorChange(newValue: string) {
      // console.log(newValue);
      this.props.currQuaternionSpaceScene?.setLineGroupColor(newValue);
    }

    onChangeLineOpacity(e:number){
      this.props.currQuaternionSpaceScene?.setLineGroupOpacity(e);
    }

    onCheckWorldFrame(event:React.FormEvent<HTMLInputElement>)
    {
      // console.log(event.currentTarget.checked);
      this.props.currQuaternionSpaceScene?.setWorldFrameObjectVisibility(event.currentTarget.checked);
  
      // force this panel to re-render so that the checkbox will be changed instantly after users click it
      this.setState({
        update: !this.state.update
      });
    }
    
  render() {
    const {currQuaternionSpaceScene} = this.props;

    // the class name in these element may seems weird
    // they are actually the class name of other elements
    // we give them same class name because we want to
    // apply same styles on these elements
    return (
      <div className={"SceneOptionPanel"} ref={this._quaternionDiv}>
        <div className="PopUpGroup">
          <LabeledTextInput
            labelValue="Name:"
            value={(currQuaternionSpaceScene === undefined) ? "No Scene" : currQuaternionSpaceScene.name()}
            onReturnPressed={(currValue) => {
              if (currQuaternionSpaceScene === undefined) return;
              currQuaternionSpaceScene.setName(currValue);
              this.props.forceUpdateTabNames();
            }}
          />
          <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.QSceneOptionPanel)}>
            <FontAwesomeIcon className="Icon" icon={faQuestion} />
          </button>
        </div>
        <div className={"ButtonsContainer"} style={{display: "flex", gap: "1rem"}}>
          <DragButton
            buttonValue={"New Quaternion Space"}
            title={"Click and drag to create a new quaternion space"}
            className={"Legend"}
            getParentDockLayout={this.props.getParentDockLayout}
            onDragStart={() => {
              let new_id = new Id().value();

              return [
                // Tab ID
                `QuaternionSpaceScene&${new_id}&motion`,

                // onDrop Callback
                (e) => { },
              ];
            }}
          />
          <DragButton
            buttonValue={"Legend"}
            className={"Legend"}
            getParentDockLayout={this.props.getParentDockLayout}
            onDragStart={() => {
              let sceneId: string = (currQuaternionSpaceScene === undefined) ? newID(4) : currQuaternionSpaceScene.id().value();
              return [
                // Tab ID
                `QuaternionSpaceLegend&${newID(4)}&${sceneId}`,

                // onDrop Callback
                (e) => { },
              ];
            }}
          />
        </div>
        <div className="top-line bottom-line">
          <div className="row-container">
            <label>Show World Frame</label>
            <label className="switch-right-label">Show</label>
            <Switch
              checked={currQuaternionSpaceScene?.isWorldFrameObjectVisible()}
              onChange={this.onCheckWorldFrame.bind(this)} />
            <label className="switch-left-label">Hide</label>
          </div>
        <LabeledSlider
          label={"Opacity of Longitude and Latitude: "}
          min={0}
          max={1}
          step={0.01}
          value={currQuaternionSpaceScene?.lineGroupOpacity()}
          onChange={this.onChangeLineOpacity.bind(this)}
        />
        </div>

        <Accordion allowZeroExpanded allowMultipleExpanded>
          <AccordionItem>
            <AccordionItemHeading>
              <AccordionItemButton style={{ fontWeight: "bold" }}>
                Background Color:
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <ColorPicker
                color={currQuaternionSpaceScene?.backgroundColor()}
                onColorMapChange={this.onBackgroundColorChange.bind(this)}
                forceUpdateTabNames={this.props.forceUpdateTabNames}
              />
            </AccordionItemPanel>
          </AccordionItem>
        </Accordion>

        <Accordion allowZeroExpanded allowMultipleExpanded>
          <AccordionItem>
            <AccordionItemHeading>
              <AccordionItemButton style={{ fontWeight: "bold" }}>
                Longitude and Latitude Color:
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <ColorPicker
                color={currQuaternionSpaceScene?.lineGroupColor()}
                onColorMapChange={this.onLineGroupColorChange.bind(this)}
                forceUpdateTabNames={this.props.forceUpdateTabNames}
              />
            </AccordionItemPanel>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }
}