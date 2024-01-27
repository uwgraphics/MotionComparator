import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { LabeledTextInput } from "../LabeledTextInput";
import { UmapGraph } from "../../objects3D/UmapGraph";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import { ColorPicker } from "../ColorPicker";

export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    getParentDockLayout: () => DockLayout | undefined,
    currSelectedGraph: UmapGraph | undefined, // the identifier of currently selected graph tab
    forceUpdateTabNames: () => void,
}

interface graph_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    currRobot: Map<string, string>,
    need_update: boolean // need to update graph data to trigger fillGraphData
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export class UmapGraphOptionPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
   
    constructor(props: graph_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            currRobot: new Map<string, string>(),
            need_update: true,
        };
        this._graphDiv = createRef();
    }

    componentDidUpdate(prevProps:graph_panel_props) {
    }

    /**
     * Handle change line width
     * @param event 
     */
    onChangeLineWidth(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setLineWidth(e);
    }

    onChangeNNeighbors(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setNNeighbors(e);
    }

    onChangeMinDis(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setMinDis(e);
    }

    onChangeSpread(e:number){
      this.props.robotSceneManager.getCurrUmapGraph()?.setSpread(e);
    }

    onBackgroundColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrUmapGraph()?.setBackgroundColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    onAxisColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrUmapGraph()?.setAxisColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    render() {
        const {currSelectedGraph} = this.props
          
        return (
          <div className={"GraphOptionPanel"} ref={this._graphDiv}>
            <div style={{ marginBottom: "5px" }} className="PopUpGroup">
              <LabeledTextInput
                labelValue="Name:"
                value={(currSelectedGraph === undefined) ? "No Umap Graph" : currSelectedGraph.name()}
                onReturnPressed={(currValue) => {
                  if(currSelectedGraph === undefined) return;
                  currSelectedGraph.setName(currValue);
                  this.props.forceUpdateTabNames();
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.UmapGraphOptionPanel)}>
                <FontAwesomeIcon className="Icon" icon={faQuestion} />
              </button>
            </div>
            <div className={"ButtonsContainer"}>
              <DragButton
                buttonValue={"New Umap Graph"}
                title={"Click and drag to create a new Umap Graph"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  
                  return [
                    // Tab ID
                    `UmapGraph&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {},
                  ];
                }}
              />
              {/* <DragButton
                buttonValue={"Legend"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  return [
                    // Tab ID
                    `UmapLegend&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {},
                  ];
                }}
              /> */}
            </div>
            <div className="top-line bottom-line">
              <LabeledSlider
                label={"Line width: "}
                min={0.1}
                max={10}
                step={0.1}
                value={currSelectedGraph?.lineWidth()}
                onChange={this.onChangeLineWidth.bind(this)}
              />
              <LabeledSlider
                label={"number of neighbors: "}
                min={1}
                max={100}
                step={1}
                value={currSelectedGraph?.nNeighbors()}
                //onChange={this.onChangeNNeighbors.bind(this)}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setNNeighbors.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"min distance: "}
                min={0.1}
                max={10}
                step={0.1}
                value={currSelectedGraph?.minDis()}
                //onChange={this.onChangeMinDis.bind(this)}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setMinDis.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
              <LabeledSlider
                label={"spread: "}
                min={0.1}
                max={1}
                step={0.01}
                value={currSelectedGraph?.spread()}
                onMouseUp={this.props.robotSceneManager.getCurrUmapGraph()?.setSpread.bind(this.props.robotSceneManager.getCurrUmapGraph())}
              />
            </div>
            <div>
              <Accordion allowZeroExpanded allowMultipleExpanded>
                <AccordionItem>
                  <AccordionItemHeading>
                    <AccordionItemButton style={{ fontWeight: "bold" }}>
                      Background Color:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <ColorPicker
                      color={currSelectedGraph?.backgroundColor()}
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
                      Axis Color:
                    </AccordionItemButton>
                  </AccordionItemHeading>
                  <AccordionItemPanel>
                    <ColorPicker
                      color={currSelectedGraph?.axisColor()}
                      onColorMapChange={this.onAxisColorChange.bind(this)}
                      forceUpdateTabNames={this.props.forceUpdateTabNames}
                    />
                  </AccordionItemPanel>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        );
    }
}