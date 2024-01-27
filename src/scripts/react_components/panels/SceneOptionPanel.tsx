import React, { Component, ReactElement, RefObject, createRef } from "react";
import { Robot } from "../../objects3D/Robot";
import { RobotJoint } from "../../objects3D/RobotJoint";
import { RobotLink } from "../../objects3D/RobotLink";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { enumerate, newID } from "../../helpers";
import {ClickButton} from "../ClickButton"
import Multiselect from "multiselect-react-dropdown";
import _ from 'lodash';
import Select from 'react-select'
import DockLayout from "rc-dock";
import { content } from "googleapis/build/src/apis/content";
import { GraphPanel } from "./GraphPanel";
import { LabeledSlider } from "../LabeledSlider";
import { DragButton } from "../DragButton";
import { FileUploader } from "../FileUploader";
import { AnimationTable } from "../../AnimationTable";
import { APP } from "../../constants";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { AnimationGroup } from "../../AnimationGroup";
import { AnimationManager } from "../../AnimationManager";
import { Animation } from "../../Animation";
import { CamerasPanel } from "./CamerasPanel";
import { LabeledTextInput } from "../LabeledTextInput";
import T from "../../true_three";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import Switch from '@mui/material/Switch';
import { PopupHelpPage } from "../popup_help_page";
import { ColorPicker } from "../ColorPicker";

export interface scene_options_panel_props {
    robotSceneManager: RobotSceneManager,
    robotScene: RobotScene,
    getParentDockLayout: () => DockLayout | undefined,
    animationManager: AnimationManager,
    addNewTimeWarpTimeBar:(targetSceneId: string) => void,
    forceUpdateTabNames: () => void,
}

interface scene_options_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    dropdowns: boolean[], // keep track of all dropdown menus, true means selected, false otherwise
    baseScene: RobotScene | undefined,
    keyObject: string,
    currRobot: Map<string, string>,
    currJoint: Map<string, string>, // mapping robot name to joint name
    need_update: boolean
    currRobotPart: Set<string>,
    currWarpedScene: RobotScene | undefined,
    applyToAllScenes: boolean,
}

type OptionList = {value: string, name: string};

export const selectStyles = {
  option: (provided: any, state: any) => ({
    ...provided,
    color: state.isFocused ? "rgb(23, 24, 25)" : 'rgb(238, 238, 238)',
    backgroundColor: state.isFocused ? "#7BB2D9" : "rgb(50, 50, 50)",
  }),
  control: (base: any) => ({
    ...base,
    height: '100%',
    width: '100%',
    backgroundColor: "rgb(50, 50, 50)",
    borderColor: "rgb(50, 50, 50)",
  }),
  container: (provided: any, state: any) => ({
    ...provided,
    height: '100%',
    width: '100%',
    display: 'inline-flex',
  }),
  menuList: (provided: any, state: any) => ({
    ...provided,
    width: "100%",
    backgroundColor: "rgb(50, 50, 50)",
  }),
  noOptionsMessage: (provided: any) => ({
    ...provided,
    height: '100%',
    width: '100%',
    backgroundColor: "rgb(50, 50, 50)",
    borderColor: "rgb(50, 50, 50)",
  }),
  placeholder:(provided: any) => ({
    ...provided,
    color: "rgb(183, 183, 189)",
  }),
  singleValue:(provided: any) => ({
    ...provided,
    color: "rgb(183, 183, 189)",
  }),
};

export class SceneOptionsPanel extends Component<scene_options_panel_props, scene_options_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected dropdownRef : any [] = []; 
    // protected isTimeWarp: boolean,
    protected _animationCsvUrlInput: RefObject<HTMLInputElement>;
    protected selectedOptions: OptionList[] = [];
   
    constructor(props: scene_options_panel_props) {
        
        super(props);
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            dropdowns: [false, false],
            baseScene: undefined,
            currRobot: new Map<string, string>(),
            currJoint: new Map<string, string>(),
            currRobotPart: new Set<string>(),
            need_update: true,
            currWarpedScene: undefined,
            applyToAllScenes: false,
            keyObject: "",
        };
        this._graphDiv = createRef();
        for(let i=0; i<2; i++)
            this.dropdownRef[i] = createRef();

        this._animationCsvUrlInput = createRef<HTMLInputElement>();
        this.onUploadAnimationCSV = this.onUploadAnimationCSV.bind(this);
        this.onLoadAnimationCSV = this.onLoadAnimationCSV.bind(this);
    }

    /**
     * Generate options for base scene dropdown
     * @returns 
     */
    genSceneOptions(){
        let result = [];
        const {robotSceneManager, robotScene} = this.props;
        for(const scene of robotSceneManager.allManagedRobotScenes()){
          if(scene !== robotScene && !scene.isTimeWarping())
            result.push({
              value: scene.id().value(), 
              label: scene.name()
            });
        }        
        return result; 
    }

    recalcTimeWarp = () => {
      APP.recalculateTimeWarping();
    }
    /**
     * Generate options for key object drop down
     * @returns 
     */
    genKeyObjectOptions(){
      let result: {value: string,  label: string; }[] = [];
      const { robotScene } = this.props;
      const baseScene = this.state.baseScene;
      
      if (baseScene === undefined) return result;
      for (const robot of robotScene.robots()) {
        if (baseScene.getRobotByName(robot.name()) !== undefined) {
          // add robot into the options
          result.push({
            value: robot.id().value(),
            label: robot.name() + "\n" + " position",
          });

          // add joint into the options
          for (const joint of robot.articuatedJoints()) {
            result.push({
              value: joint.id().value(),
              label: robot.name() + "\n" + joint.name() + " position",
            })
            result.push({
              value: joint.id().value(),
              label: robot.name() + "\n" + joint.name() + " angle",
            })
          }

          // add link into the options
          for (const link of robot.links()) {
            result.push({
              value: link.id().value(),
              label: robot.name() + "\n" + link.name() + " position",
            })
          }

        }
      }
      return result; 
    }

    /**
     * Handle changing scenes
     * @param e 
     * @returns 
     */
    onChangeScene(e:any){
      //TODO deactivate scenes after nothing is graphed?
      this.deselectDropdowns(0);
      const value = e.value;
      if(!value) return;
      const rsmanager = this.props.robotSceneManager;
      const scene = rsmanager.robotSceneById(value);
      if(!scene) return;
      // activate selected robot scene if not already active to update timebar
      if(!rsmanager.activeRobotScenes().includes(scene)){
          rsmanager.activateRobotScene(scene);
      }
      this.setState({
        baseScene: scene,
      });
      this.selectDropdowns(0);
    }

    /**
     * Handle changing scenes
     * @param e 
     * @returns 
     */
    onChangeKeyObject(e:any){
      //TODO deactivate scenes after nothing is graphed?
      this.deselectDropdowns(1);
      const value = e.label;
      if(!value) return;
      
      this.setState({
        keyObject: value,
      });
      this.selectDropdowns(1);
    }

    componentDidUpdate(prevProps:scene_options_panel_props) {
      const {robotScene} = this.props;
      let robotSceneChanges: boolean = (robotScene !== prevProps.robotScene);
      if(robotSceneChanges && !robotScene.isTimeWarping())
      {
        this.dropdownRef[0].current.setValue(this.dropdownRef[0].current.state.prevProps.placeholder);
        this.deselectDropdowns(0);
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
        if(1 == index + 1)
            this.selectedOptions = [];
        else if(this.dropdownRef[index+1] != undefined)
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
     * update the currSelectedGraph to the new one
     * @param id the id of the newly created Graph TAB
     */
    createNewGraphTab(id: string)
    {
      
    }

  /**
   * Handle confirm button clicks
   * @param event 
   */
  onConfirm(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    for (let i = 0; i < 2; i++) // check whether the first four dropdowns are selected
    {
      if (!this.state.dropdowns[i])
        throw new Error(`${i} Not every dropdown is selected. Need to select all dropdowns to show the graph`);
    }
    // if (this.selectedOptions.length == 0) // check whether the multiselect is selected
    //   throw new Error(`Not every dropdown is selected. Need to select all dropdowns to show the graph`);

    const { robotScene, robotSceneManager } = this.props;
    const {baseScene, keyObject} = this.state;
    // set the time warp base scene
    // robotSceneManager.setTimeWarpBase(baseScene);

    // clone the current scene
    const currSceneData = robotScene ? robotSceneManager.getManagedRobotSceneData(robotScene) : undefined;
    if (currSceneData !== undefined) {

      // clone the target scene
      let clone = currSceneData.robotScene.clone(true, false, false);
      this.setState({currWarpedScene: clone});
      clone.setName(robotScene.name() + " Time Warped Based On " + baseScene?.name());
      robotSceneManager.addManagedRobotScenes([{
        path: [...currSceneData.path],
        robotScene: clone,
        metrics: new Map(currSceneData.metrics),
      }]);

      clone.setTimeWarpBase(baseScene);

      // let keyObjects: string[] = [];
      // add time warp objects
      // for (const option of this.selectedOptions) {
        // keyObjects.push(option.name);
        const[robotName, content] = keyObject.split("\n");
        const [robotPartName, typeName] = content.split(" ");
        // console.log(robotPartName);
        // console.log(typeName);
        if(robotPartName.length === 0) // robot itself as a key object
        {
          // console.log(robotName);
          let robot = clone.getRobotByName(robotName);
          robot?.setPositionIncludeInTimeWarpConsideration(true);
        }
        else {
          let robotPart: RobotJoint | RobotLink | undefined = clone.getJointByName(robotName, robotPartName);
          if (robotPart === undefined) {
            robotPart = clone.getLinkByName(robotName, robotPartName);
            robotPart?.setPosIncludeInTimeWarpConsideration(true);
          }
          else {
            if (typeName == "angle")
              robotPart.setAngleIncludeInTimeWarpConsideration(true);
            else
              robotPart.setPosIncludeInTimeWarpConsideration(true);
          }
        }

        // recalculate time warp
        clone.setTimeWarpBase(undefined);
        clone.setTimeWarpBase(baseScene);
      //}
      // clone.setKeyObjects(keyObjects);
      clone.setKeyObjects([keyObject]);
    }
  }

  /**
   * Handle making a new time warp bar
   * @param event 
   */
  onTimeWarpBar(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const { robotScene, robotSceneManager } = this.props;
    if (robotScene.isTimeWarping()) {
        this.props.addNewTimeWarpTimeBar(robotScene.id().value());
    }
    else {
      if (this.state.currWarpedScene !== undefined)
        this.props.addNewTimeWarpTimeBar(this.state.currWarpedScene.id().value());
    }
  }


    onAddGroup() {
      this.props.animationManager.addStoredAnimation(
          new AnimationGroup()
      );
    }
    /**
    * remove animations associated with robot in current group
    * @param group 
    * @param robot 
    */
    deleteAnimationAssociatedwithRobot(group: AnimationGroup, robot: Robot)
    {
      let animations = [...group.animations()];
      for (let i = 0; i < animations.length; i++) {
        if (robot === animations[i].robot()) {
          console.log("remove animations!!!!");
          group.removeAnimation(animations[i]);
        }
      }
    }
    /**
    * automatically bind the new animation to the robots in the current scene
    * This function will be called whenever users upload or load a csv animation file
    * @param table the new animation table built from newly uploaded/loaded csv file
    */
    autoBindNewAnimationtoRobot(table: AnimationTable)
    {
      console.log("auto bind new animation with robot!!!");
      let robotNames = table.robotNames();
      const { robotScene } = this.props;
      for (const robot of robotScene.robots()) {
        // console.log(robot.name());
        if (robotNames.has(robot.name())) {
          // find robot name
          // console.log(this.props.animationManager.animationGroups());
          if (this.props.animationManager.animationGroups.length === 0) {
            this.onAddGroup();
          }
          for (const [i, group] of enumerate(this.props.animationManager.animationGroups())) {
            this.deleteAnimationAssociatedwithRobot(group, robot);
            group.addAnimation(new Animation(robot, table));
            // Activate the group (because otherwise people forget to).
            if (this.props.animationManager.activeAnimations().indexOf(group) === -1) {
              // Activate the group
              this.props.animationManager.addActiveAnimation(group);
            }
          }
        }
      }
    }
    async onLoadAnimationCSV():Promise<void> {
      const messageElements = document.querySelectorAll('.LoadCSVMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
      let current = this._animationCsvUrlInput.current;
      if (current) {
        let url: string = current.value;
        if (url.length > 0) {
          for (const table of await AnimationTable.loadFromURL(url,"ReloadCSV")) {
            this.props.robotSceneManager.addAnimationTable(table);
            this.autoBindNewAnimationtoRobot(table);
          }
        } else {
          APP.error(
            `Failed to load the animation CSV file: The URL for the animation CSV file was empty!`
          );
        }
      }
    }

    async onUploadAnimationCSV(event:React.FormEvent<HTMLInputElement>):Promise<void> {
      const messageElements = document.querySelectorAll('.LoadCSVMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
      let jsonFileLoc: FileList | null = event.currentTarget.files;

      if (jsonFileLoc) {
        for (const file of jsonFileLoc) {
          for (const table of await AnimationTable.loadFromLocalFile(file,"ReloadCSV")) {
            this.props.robotSceneManager.addAnimationTable(table);
            this.autoBindNewAnimationtoRobot(table);
          }
        }
      }
    }

  /**
   * Display the key object options if the selected scene is not time warped.
   * Otherwise display the key object of the selected time warped scene.
   * @param isTimeWarp 
   * @returns 
   */
  displayKeyObjects(isTimeWarp: boolean) {
    let content: ReactElement;
    if (isTimeWarp) {
      const { robotScene} = this.props;
      let keyObjects = robotScene.keyObjects();
      content = (
        <div>
        {keyObjects.map((keyObject) => (
          <p key={keyObject}>{keyObject}</p>
        ))}
        </div>
      );
    }
    else
      content = (
        // <Multiselect
        //   placeholder={"Select a key object ..."}
        //   showCheckbox={true}
        //   displayValue={"name"}
        //   style={{
        //     option: {
        //       color: "black",
        //       fontSize: "15px",
        //     },
        //     searchBox: {
        //       // fontSize: "25px",
        //       backgroundColor: "rgb(23, 24, 25)",
        //     },
        //     inputField: { // To change input field position or margin
        //       fontSize: "15px",
        //       marginLeft: "5px",
        //     },
        //   }}
        //   onSelect={(_, selectedItem: OptionList) => {
        //     this.selectedOptions.push(selectedItem);
        //     //console.log("select " + selectedItem.name);
        //   }}
        //   onRemove={(_, removedItem: OptionList) => {
        //     // console.log("remove " + removedItem.value);
        //     this.selectedOptions = this.selectedOptions.filter(
        //       (option) => option.value !== removedItem.value
        //     );
        //     //console.log(this.selectedOptions.length + " remaining");
        //   }}
        //   options={this.genKeyObjectOptions()}
        //   selectedValues={this.selectedOptions}
        // />
        <Select
          placeholder={"Select key objects ..."}
          ref={this.dropdownRef[1]}
          options={this.genKeyObjectOptions()}
          onChange={this.onChangeKeyObject.bind(this)}
          isSearchable={true}
          styles={selectStyles}
        />

      );
    return content;
  }
  /**
   * Display the base scene options if the selected scene is not time warped.
   * Otherwise display the base scene of the selected time warped scene.
   * @param isTimeWarp 
   * @returns 
   */
  displayBaseScene(isTimeWarp: boolean) {
    let content: ReactElement;
    if (isTimeWarp) {
      const {robotScene, robotSceneManager} = this.props;
      let sceneName = robotSceneManager.robotSceneById(robotScene.baseSceneId())?.name();
      content = (
        <p>{sceneName}</p>
      );
    }
    else
      content = (
        <Select
          placeholder={"Select a base scene ..."}
          ref={this.dropdownRef[0]}
          options={this.genSceneOptions()}
          onChange={this.onChangeScene.bind(this)}
          isSearchable={true}
          styles={selectStyles}
        />
      );
    return content;
  }

  onTraceSizeChange():(newValue:number) => void {
    return (newValue:number) => {
        this.props.robotScene.setTraceSize(newValue);
        if(this.state.applyToAllScenes)
          this.applyChangesToAll();
    }
  }

  onAxisSizeChange():(newValue:number) => void {
    return (newValue:number) => {
        this.props.robotScene.setAxisSize(newValue);
        if(this.state.applyToAllScenes)
          this.applyChangesToAll();
    }
  }

  onDensityChange():(newValue:number) => void {
    return (newValue:number) => {
        this.props.robotScene.setDensity(newValue);
        if(this.state.applyToAllScenes)
          this.applyChangesToAll();
    }
  }

  onDirectionalLightChange():(newValue:number) => void {
    return (newValue:number) => {
        this.props.robotScene.setDirectionalLightIntensity(newValue);
        if(this.state.applyToAllScenes)
          this.applyChangesToAll();
    }
  }

  onAmbientLightChange():(newValue:number) => void {
    return (newValue:number) => {
        this.props.robotScene.setAmbientLightIntensity(newValue);
        if(this.state.applyToAllScenes)
          this.applyChangesToAll();
    }
  }

  onColorMapChange(newValue: string) {
    // console.log(newValue);
    this.props.robotScene.setBackgroundColor(newValue);
    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
  }

  onGroundPlaneColorChange(newValue: string) {
    // console.log(newValue);
    this.props.robotScene.setGroundPlaneColor(newValue);
    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
  }

  // onColorMapChange(): (newValue:string) => void {
  //   return (newValue:string) => {
  //     console.log(newValue);
  //     this.props.robotScene.scene().background = new T.Color(newValue);
  //     this.props.robotScene.render();
  //   }
  // }

  onCheckGroundPlane(event:React.FormEvent<HTMLInputElement>)
  {
    // console.log(event.currentTarget.checked);
    this.props.robotScene.setGroundPlaneVisibility(event.currentTarget.checked);

    // force this panel to re-render so that the checkbox will be changed instantly after users click it
    this.setState({
      need_update: !this.state.need_update
    });

    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
  }

  onCheckWorldFrame(event:React.FormEvent<HTMLInputElement>)
  {
    // console.log(event.currentTarget.checked);
    this.props.robotScene.setWorldFrameObjectVisibility(event.currentTarget.checked);

    // force this panel to re-render so that the checkbox will be changed instantly after users click it
    this.setState({
      need_update: !this.state.need_update
    });

    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
  }

  toggleWorldFrame() {
    this.props.robotScene.toggleWorldFrame();
    this.setState({ // triggers scene option panel to update
      need_update: !this.state.need_update
    });
    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
    this.props.forceUpdateTabNames();  // triggers the robot canvas to update
  }

  toggleCameraType() {
    this.props.robotScene.toggleCameraType();
    this.setState({ // triggers scene option panel to update
      need_update: !this.state.need_update
    });
    if(this.state.applyToAllScenes)
      this.applyChangesToAll();
    this.props.forceUpdateTabNames();  // triggers the robot canvas to update
  }

  onCheckApplytoAll(event:React.FormEvent<HTMLInputElement>)
  {
    this.setState({
      applyToAllScenes: event.currentTarget.checked,
    });
    
    this.applyChangesToAll();
  }

  /**
   * apply changes to all scenes
   */
  applyChangesToAll()
  {
    const {robotScene} = this.props;
    const backgroundColor = robotScene.backgroundColor();
    const ambientLightIntensity = robotScene.ambientLightIntensity();
    const directionalLightIntensity = robotScene.directionalLightIntensity();
    const showGroundPlane = robotScene.isGroundPlaneVisible();
    const worldFrame = robotScene.worldFrame();
    const cameraType = robotScene.cameraType();
    const axisSize = robotScene.axisSize();
    const axisDensity = robotScene.density();
    const showWorldFrameObject = robotScene.isWorldFrameObjectVisible();
    const traceSize = robotScene.traceSize();
    const groundPlaneColor = robotScene.groundPlaneColor();
    for(const scene of this.props.robotSceneManager.allManagedRobotScenes())
    {
      scene.setBackgroundColor(backgroundColor);
      scene.setAmbientLightIntensity(ambientLightIntensity);
      scene.setDirectionalLightIntensity(directionalLightIntensity);
      scene.setGroundPlaneVisibility(showGroundPlane);
      scene.setWorldFrame(worldFrame);
      scene.setCameraType(cameraType);
      scene.setAxisSize(axisSize);
      scene.setDensity(axisDensity);
      scene.setWorldFrameObjectVisibility(showWorldFrameObject);
      scene.setTraceSize(traceSize);
      scene.setGroundPlaneColor(groundPlaneColor);
    }
  }

    // check if time has changed in render manually
    render() {
        //const isTimeWarp = this.props.isTimeWarp;
        const {robotScene, robotSceneManager} = this.props;
        const {currWarpedScene} = this.state;
        

        const isTimeWarp = robotScene.isTimeWarping();

        let axis_size = robotScene.axisSize();
        let density = robotScene.density();

        return (
          <div className={"SceneOptionPanel"} ref={this._graphDiv}>
            <div className="PopUpGroup">
              <LabeledTextInput
                labelValue="Scene Name:"
                value={robotScene.name()}
                onReturnPressed={(currValue) => {
                  robotScene.setName(currValue);
                  this.props.forceUpdateTabNames();
                }}
              />
              <DragButton
                buttonValue={"Legend"}
                title={"Click and drag to add a legend to the scene"}
                className={"Legend"}
                getParentDockLayout={this.props.getParentDockLayout}
                onDragStart={() => {

                  return [
                    // Tab ID
                    `SceneLegend&${newID(4)}&${this.props.robotScene.id().value()}`,

                    // onDrop Callback
                    (e) => {
                    },
                  ];
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.SceneOptionPanel)}>
                <FontAwesomeIcon className="Icon" icon={faQuestion} />
              </button>
            </div>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Appearance
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <div className={"SceneViews"}>

                    <div>

                      <div className="row-container">
                        <label>Ground Plane:</label>
                          <label className="switch-left-label"> Show</label>
                          <Switch 
                            checked={robotScene.isGroundPlaneVisible()}
                            onChange={this.onCheckGroundPlane.bind(this)}
                          />
                          <label className="switch-right-label"> Hide </label>
                      </div>

                      <div className="row-container">
                        <label> World Frame:</label>
                          <label className="switch-left-label"> Show</label>
                          <Switch
                            checked={robotScene.isWorldFrameObjectVisible()}
                            onChange={this.onCheckWorldFrame.bind(this)}
                          />
                          <label className="switch-right-label"> Hide </label>
                      </div>

                      <div className="row-container">
                        <label>World Frame Convention:</label>
                          <label className="switch-left-label"> ROS</label>
                          <Switch
                            checked={robotScene.worldFrame() === "THREE.js"}
                            onChange={this.toggleWorldFrame.bind(this)}
                          />
                          <label className="switch-right-label">THREE.js </label>
                      </div>
                    
                    </div>

                    <div className="top-line">
                      <LabeledSlider
                        label={"Directional Light Intensity"}
                        value={robotScene.directionalLightIntensity()}
                        min={0}
                        max={10}
                        step={0.1}
                        onChange={this.onDirectionalLightChange()}
                      />
                      <LabeledSlider
                        label={"Ambient Light Intensity"}
                        value={robotScene.ambientLightIntensity()}
                        min={0}
                        max={10}
                        step={0.1}
                        onChange={this.onAmbientLightChange()}
                      />
                    </div>
                    <div className="top-line">
                      <LabeledSlider
                        label={"Trace Size"}
                        value={robotScene.traceSize()}
                        min={0.0001}
                        max={5}
                        step={0.001}
                        onChange={this.onTraceSizeChange()}
                        key={"trace size"}
                      />
                      <LabeledSlider
                        label={"Axis Size"}
                        value={axis_size}
                        min={0}
                        max={0.2}
                        step={0.001}
                        onChange={this.onAxisSizeChange()}
                        key={"axis size"}
                      />
                      <LabeledSlider
                        label={"Axis Density"}
                        value={density}
                        min={0.0001}
                        max={1}
                        step={0.001}
                        onChange={this.onDensityChange()}
                        key={"density"}
                      />
                    </div>

                    <div className="top-line">
                      <Accordion allowZeroExpanded allowMultipleExpanded>
                        <AccordionItem>
                          <AccordionItemHeading>
                            <AccordionItemButton>
                              Background Color
                            </AccordionItemButton>
                          </AccordionItemHeading>
                          <AccordionItemPanel>
                            <ColorPicker
                              color={robotScene.backgroundColor()}
                              onColorMapChange={this.onColorMapChange.bind(this)}
                              forceUpdateTabNames={this.props.forceUpdateTabNames}
                            />
                          </AccordionItemPanel>
                        </AccordionItem>
                      </Accordion>
                      <Accordion allowZeroExpanded allowMultipleExpanded>
                        <AccordionItem>
                          <AccordionItemHeading>
                            <AccordionItemButton>
                              Ground Plane Color
                            </AccordionItemButton>
                          </AccordionItemHeading>
                          <AccordionItemPanel>
                            <ColorPicker
                              color={robotScene.groundPlaneColor()}
                              onColorMapChange={this.onGroundPlaneColorChange.bind(this)}
                              forceUpdateTabNames={this.props.forceUpdateTabNames}
                            />
                          </AccordionItemPanel>
                        </AccordionItem>
                      </Accordion>
                    </div>
                    <div className="top-line">
                      <div className="row-container">
                        <label> Apply Changes to All Scenes</label>
                        <Switch
                          checked={this.state.applyToAllScenes}
                          onChange={this.onCheckApplytoAll.bind(this)} />
                      </div>
                    </div>

                  </div>
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>

            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Camera
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  <div className={"SceneViews"}>
                   
                    <div>
                      <div >
                        <CamerasPanel robotSceneManager={robotSceneManager} />
                      </div>

                    
                      <div className="row-container">
                        <label>Camera Type:</label>
                        <label className="switch-right-label">Orthographic</label>
                        <Switch
                          checked={robotScene.cameraType() === "Orthographic"}
                          onChange={this.toggleCameraType.bind(this)}
                        />
                        <label className="switch-left-label">Perspective</label>
                      </div>
                    </div>
                  </div>
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Time Warping Options
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div>
                      <div className={"row-container"}>
                        <label>Base Scene : </label>
                        <div className={"Select-container"} >
                          {this.displayBaseScene(isTimeWarp)}
                        </div>
                      </div>
                      <div className={"row-container"}>
                        <label>Key Object : </label>
                        <div className={"Select-container"}>
                          {this.displayKeyObjects(isTimeWarp)}
                        </div>
                      </div>
                      
                      <div className={"ButtonsContainer"} style={{display: "flex", gap: "1rem"}}>
                        {!isTimeWarp && <ClickButton buttonValue="Confirm" onClick={this.onConfirm.bind(this)}/>}
                        <ClickButton buttonValue="Warped Time Bar" onClick={this.onTimeWarpBar.bind(this)}/>
                        <DragButton
                          className={"TimeWarp"}
                          title={"Click and drag to create a time warp graph"}
                          buttonValue={"Warping Graph"}
                          getParentDockLayout={this.props.getParentDockLayout}
                          onDragStart={() => {
                            let new_id = newID(4);
                            let warpedSceneId = (robotScene.isTimeWarping()) ? robotScene.id().value() : currWarpedScene?.id().value();
                            return [
                              // Tab ID
                              `TimeWarpedGraph&${new_id}&${warpedSceneId}&motion`,

                              // onDrop Callback
                              (e) => { this.createNewGraphTab(new_id) },
                            ];
                          }}
                        />
                      </div>
                    </div>
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Edit Motion
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div className="ReloadCSV">
                      <div className="row-container">
                        <label>Replace with a local animation: </label>
                        <FileUploader
                          accept={[".csv"]}
                          vertical={false}
                          onChange={this.onUploadAnimationCSV}
                        />
                      </div>

                      <div className="row-container">
                        <label>Replace with an online animation: </label>
                        <input
                          ref={this._animationCsvUrlInput}
                          type="text"
                          placeholder=" URL "
                        />
                        <input
                          type="button"
                          value="Load"
                          onClick={this.onLoadAnimationCSV}
                        />
                      </div>
                    </div>
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
          </div>
        );
    }
}