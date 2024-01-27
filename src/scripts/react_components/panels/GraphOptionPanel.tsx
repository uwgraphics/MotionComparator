import React, { Component, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotJoint } from "../../objects3D/RobotJoint";
import { RobotLink } from "../../objects3D/RobotLink";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { newID } from "../../helpers";
import _ from 'lodash';
import Select from 'react-select'
import DockLayout from "rc-dock";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { Graph } from "../../objects3D/Graph";
import { LabeledTextInput } from "../LabeledTextInput";
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
import { selectStyles } from "./SceneOptionPanel";
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import { ColorPicker } from "../ColorPicker";
import { Color } from "three";


export interface graph_panel_props {
    robotSceneManager: RobotSceneManager,
    //robotScene: RobotScene,
    updateGraphPropertyPanelState: (eventName?:string[], add?:boolean, filter?:number, currSelectedGraph?:Graph, legend?:boolean, clear_options?: boolean) => void,
    filter_prop: number,
    getParentDockLayout: () => DockLayout | undefined,
    forceUpdateTabNames: () => void,
}

interface graph_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    dropdowns: boolean[], // keep track of all dropdown menus, true means selected, false otherwise
    currScene: RobotScene | null,
    currRobot: Map<string, string>,
    currJoint: Map<string, string>, // mapping robot name to joint name
    need_update: boolean // need to update graph data to trigger fillGraphData
    currSelectedGraph: Graph | undefined,
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
type speciProperties = 'magnitude' | "x" | "y" | "z" | "angle";
type dataType = "joint position"|"joint velocity"|"joint acceleration"|"joint jerk" 
| "Cartesian position"|"Cartesian velocity"|"Cartesian acceleration"|"Cartesian jerk"|"rotation";
type OptionList = {name:string};
export class GraphOptionPanel extends Component<graph_panel_props, graph_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected data_types:dataType[] = ["joint position", "joint velocity", "joint acceleration", "joint jerk",
      "Cartesian position", "Cartesian velocity", "Cartesian acceleration", "Cartesian jerk", "rotation"];
    protected speci_property_types: speciProperties[] = ['magnitude', 'x', 'y', 'z', 'angle']; // TODO need to update, should use speciProperties instead of vectorKeys
    protected selectedOptions: OptionList[] = [];
    protected dropdownRef : any [] = []; 
    protected currDataType: dataType; // which of the 4 data types are currently selected
    protected currSpeciProperty: speciProperties; // the details, i.e. x, y, z, angle...
    //protected isTimeWarp: boolean,
   
    constructor(props: graph_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            dropdowns: [false, false],
            currScene: null,
            currRobot: new Map<string, string>(),
            currJoint: new Map<string, string>(),
            // currDataType: this.data_types[0],
            // currSpeciProperty: this.speci_property_types[0],
            need_update: true,
            currSelectedGraph: undefined,
        };
        this._graphDiv = createRef();
        for(let i=0; i<2; i++)
            this.dropdownRef[i] = createRef();
        this.currDataType = this.data_types[0];
        this.currSpeciProperty = this.speci_property_types[0];
    }


    /**
     * Helper function to compute number of true in a boolean array
     * @param arr 
     * @returns sum of arr
     */
    booleanSum(arr:boolean[]):Number{
        let sum = 0;
        for(const a of arr){
            sum += Number(a);
        }
        return sum;
    }

    /**
     * Generate options for property dropdown
     * @returns 
     */
    genPropertyOptions(){
        let result = [];
        let currGraph = this.props.robotSceneManager.getCurrGraph();
        for(const dt of this.data_types){
            if(dt === "rotation" && currGraph !== undefined && !currGraph.isDiff()) continue;
            result.push({
                value: dt, 
                label: dt
            });
        }        
        return result; 
    }

    /**
     * Generate options for specific property (x, y, z, angle) dropdown
     * @returns 
     */
    genSpeciPropertyOptions(){
        let result = [];
        
        for(const dt of this.speci_property_types){
            result.push({
              value: dt, 
              label: dt
            });
        }        
        return result; 
    }

    componentDidUpdate(prevProps:graph_panel_props) {
      if(this.props.robotSceneManager.getCurrGraph() !== this.state.currSelectedGraph)
      {
        this.setState({
          currSelectedGraph: this.props.robotSceneManager.getCurrGraph(),
        });
        this.setOptions();
      }
    }
    /**
     * deselect the chosen dropdown, 
     * it automatically reset the subsequent selection (display the placeholder value),
     * and set the curresponding dropdown to false
     * @param index 
     * @returns 
     */   
    deselectDropdowns(index: number)
    {
        this.state.dropdowns[index] = false;
        if(this.dropdownRef[index+1] != undefined && this.dropdownRef[index+1].current != undefined)
            this.dropdownRef[index+1].current.setValue(this.dropdownRef[index+1].current.state.prevProps.placeholder);
    }

    /**
     * select the chosen dropdown, set the curresponding dropdown to false
     * @param index 
     * @returns 
     */   
    selectDropdowns(index: number)
    {
        this.state.dropdowns[index] = true;
    }

    /**
     * Handle changing property
     * @param e 
     * @returns 
     */
    onChangeProperty(e:any){
        // console.log(this.dropdownRef[0].current);
        this.deselectDropdowns(0);
        const value = e.value;
        if(!value) return;
        this.currDataType = value;
        this.selectDropdowns(0);
        if(value === "rotation")
        {
          this.selectDropdowns(1);
          this.onUpdate(value, "x");
        }
        else if(value !== "position")
        {
          this.selectDropdowns(1);
          this.currSpeciProperty = "magnitude";
          this.dropdownRef[1].current.setValue({
            value: "magnitude", 
            label: "magnitude",
          });
          this.onUpdate(value, "magnitude");
        }
          
    }

     /**
     * Handle changing a specific property
     * @param e 
     * @returns 
     */
    onChangeSpeciProperty(e:any){
        //TODO deactivate scenes after nothing is graphed?
        this.state.dropdowns[1] = false;
        const value = e.value;
        if(!value) return;
        this.currSpeciProperty = value;
        this.selectDropdowns(1);
        this.onUpdate(this.currDataType, value);
    }

    /**
     * Handle update graph button clicks
     */
    onUpdate(currDataType:string, currSpeciProperty:string){
        for(let i=0; i<2; i++) // check whether the first four dropdowns are selected
        {
            if(!this.state.dropdowns[i])
                throw new Error(`${i} Not every dropdown is selected. Need to select all dropdowns to show the graph`);
        }
        
        console.log("on Update");
        let eventName = [];
        // let [dataType, speciProperty] = this.processProperties(currDataType, currSpeciProperty);
        eventName[0] = "&" + currSpeciProperty + "&" + currDataType;
        this.props.robotSceneManager.getCurrGraph()?.setCurrProperty(eventName[0]);
        this.props.updateGraphPropertyPanelState(eventName, true, undefined, undefined);
    }

    /**
     * decompose the eventName
     * to sceneId, robotName, partName, currSpeciProperty, currDataType
     * @param eventName
     * @returns 
     */
    decomposeEventName(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName, currSpeciProperty, currDataType] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName, currSpeciProperty, currDataType];
    }

    /**
     * Handle legend button clicks
     * @param event 
     */
    // onLegend(event:React.MouseEvent<HTMLButtonElement, MouseEvent>){
    //   console.log("on legend");
    //   this.props.updateGraphPropertyPanelState(undefined, undefined, undefined, undefined, !this.props.legend_prop);
    // }

    /**
     * Handle options button clicks
     * @param selectedOptions 
     * @returns
     */
    convertOptionListtoSpeciProperties(selectedOptions:OptionList[]){
        let result: speciProperties[] = [];
        for(let i=0; i<selectedOptions.length; i++)
        {
            const name = selectedOptions[i].name;
            if(name === 'x' || name === 'y' || name === 'z' || name === 'angle')
                result[i] = name;
            else
                throw Error(`${name} is not a valid specific property`);
        }
        return result;
    }

    /**
     * set options to the property of the current selected graph
     */
    setOptions()
    {
      let currSelectedGraph = this.props.robotSceneManager.getCurrGraph();
      if(currSelectedGraph === undefined) return;
      const [, detail, property] = currSelectedGraph.currProperty().split("&");
      this.dropdownRef[0].current.setValue({value: property, label: property}); 
      this.dropdownRef[1].current.setValue({value: detail, label: detail}); 
      // console.log(this.dropdownRef[0].current);
    }

    /**
     * update the currSelectedGraph to the new one
     * @param id the id of the newly created Graph TAB
     */
    createNewGraphTab(id: string, isDiff: boolean)
    {
      let graph = new Graph(id, isDiff, false);
      this.props.updateGraphPropertyPanelState(undefined, undefined, undefined, graph);
    }
    /**
     * Handle change filter
     * @param event 
     */
    onChangeFilter(e:number){
        console.log("on change filter");
        // this.props.updateGraphPropertyPanelState(undefined, undefined, e);
        this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
        this.props.robotSceneManager.getCurrGraph()?.setFilter(e);
    }
    /**
     * Handle change line width
     * @param event 
     */
    onChangeLineWidth(e:number){
      this.props.robotSceneManager.getCurrGraph()?.setLineWidth(e);
    }

    onBackgroundColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrGraph()?.setBackgroundColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    onAxisColorChange(newValue: string) {
      this.props.robotSceneManager.getCurrGraph()?.setAxisColor(newValue);
      this.props.forceUpdateTabNames(); // trigger the graph update instantaneously
    }

    // check if time has changed in render manually
    render() {
        const {filter_prop} = this.props
        // if(currSelectedGraph === undefined) return (
        //   <div className={"GraphOptionPanel"} key={newID(4)}>
        //   This tab is for selecting which graph (if any)
        //   you would like. You do not have a graph selected currently,
        //   so this cannot be done. Please select a graph.
        // </div>
        // );
        //const isTimeWarp = this.props.isTimeWarp;

        let speciPropertiesOptionStyle = {display: "flex"};
        if(this.currDataType.startsWith("joint")) speciPropertiesOptionStyle = {display: "none"};
        

        let currSelectedGraph = this.props.robotSceneManager.getCurrGraph();
        return (
          <div className={"GraphOptionPanel"} ref={this._graphDiv}>
            <div style={{ marginBottom: "5px" }} className="PopUpGroup">
              <LabeledTextInput
                labelValue="Name:"
                value={currSelectedGraph?.name()}
                onReturnPressed={(currValue) => {
                  currSelectedGraph?.setName(currValue);
                  this.props.forceUpdateTabNames();
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.GraphOptionPanel)}>
                      <FontAwesomeIcon className="Icon" icon={faQuestion} />
                  </button>
            </div>

            <div className={"labeledSelect"}>
              <label> Y-axis: </label>
              <div className={"select-container"}>
                <Select
                  placeholder={"Select a property ..."}
                  ref={this.dropdownRef[0]}
                  options={this.genPropertyOptions()}
                  onChange={this.onChangeProperty.bind(this)}
                  isSearchable={true}
                  styles={selectStyles}
                />
              </div>
              <div className={"Select"} style={speciPropertiesOptionStyle}>
                <span>Details:</span>
                <div className={"Select-container"}>
                  <Select
                    placeholder={"Select a specific property ..."}
                    ref={this.dropdownRef[1]}
                    options={this.genSpeciPropertyOptions()}
                    onChange={this.onChangeSpeciProperty.bind(this)}
                    isSearchable={true}
                    styles={selectStyles}
                  />
                </div>
              </div>
              
              {/* <div className={"ButtonsContainer"}>
                <ClickButton
                  buttonValue="Update Graph"
                  onClick={this.onUpdate.bind(this)}
                />
              </div> */}
            </div>
            <div className={"ButtonsContainer"}>
              <DragButton
                buttonValue={"New Graph"}
                title={"Click and drag to create a new graph"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  
                  return [
                    // Tab ID
                    `Graph&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {this.createNewGraphTab(new_id, false)},
                  ];
                }}
              />
              <DragButton
                buttonValue={"Difference Graph"}
                title={"Click and drag to create a new difference graph"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {
                  let new_id = newID(4);
                  return [
                    // Tab ID
                    `DifferenceGraph&${new_id}&motion`,

                    // onDrop Callback
                    (e) => {this.createNewGraphTab(new_id, true)},
                  ];
                }}
              />
            </div>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Graph Views
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <div className={"GraphViews"}>
                    <LabeledSlider
                      label={"Convolution Filtering Level: "}
                      min={0}
                      max={10}
                      step={1}
                      value={currSelectedGraph?.filter()}
                      onChange={this.onChangeFilter.bind(this)}
                    />
                    <LabeledSlider
                      label={"Line width: "}
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={currSelectedGraph?.lineWidth()}
                      onChange={this.onChangeLineWidth.bind(this)}
                    />
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
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            
              
            {/* <div style={{marginBottom: "20px"}}>
              <span>Display/Hide Legend: </span>
              <ClickButton
                buttonValue="Legend"
                onClick={this.onLegend.bind(this)}
              />
            </div> */}
            
          </div>
        );
    }
}