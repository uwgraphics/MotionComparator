import React, { Component, createRef } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { newID } from "../../helpers";
import _ from 'lodash';
import DockLayout from "rc-dock";
import { LabeledTextInput } from "../LabeledTextInput";
import { LabeledCheckBox } from "../LabeledCheckBox";
import { APP } from "../../constants";
import { RobotJointsPanel } from "./RobotJointsPanel";
import { AnimationManager } from "../../AnimationManager";
import { AnimationEditor } from "../AnimationEditor";
import {
    Accordion,
    AccordionItem,
    AccordionItemHeading,
    AccordionItemButton,
    AccordionItemPanel,
  } from 'react-accessible-accordion';
import { DataTable } from "../DataTable";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { PopupHelpPage } from "../popup_help_page";
import Select from 'react-select';
import { Robot } from "../../objects3D/Robot";
import { AnimationTable, joint_motion_data, tf_data } from "../../AnimationTable";
import { AnimationGroup } from "../../AnimationGroup";
import { enumerate } from "../../helpers";
import { LoadAndSavePanel } from "./LoadAndSavePanel";
import { Animation } from "../../Animation";
import { LabeledSlider } from "../LabeledSlider";
import Switch from '@mui/material/Switch';
import { selectStyles } from "./SceneOptionPanel";

export interface robot_options_panel_props {
    robotSceneManager: RobotSceneManager,
    getParentDockLayout: () => DockLayout | undefined,
    animationManager: AnimationManager,
}

interface robot_options_panel_state {
    counter:number,
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
    need_update: boolean, // need to update graph data to trigger fillGraphData
    show_data: boolean,
}
export interface time_obj{
    start: number,
    end: number,
    curr: number
}
export class RobotOptionsPanel extends Component<robot_options_panel_props, robot_options_panel_state> {
    protected _panel_resize_observer?: ResizeObserver;
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected _jointMotionOptions: {value: string, label: string}[] = [];
    protected dropdownRef : any[]; 
    // protected isTimeWarp: boolean,
   
    constructor(props: robot_options_panel_props) {
        super(props);
        const {robotSceneManager} = this.props;
        this.state = {
            counter: 0,
            panelHeight: 620,
            panelWidth: 1200,
            need_update: true,
            show_data: false,
        };
        this._graphDiv = createRef();
        this.dropdownRef = [];
        for(let i=0; i<2; i++)
          this.dropdownRef[i] = createRef();

        this.onShowRobot = this.onShowRobot.bind(this);
        this.onOpacityChange = this.onOpacityChange.bind(this);
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

    componentDidUpdate(prevProps:robot_options_panel_props) {
    }

    onSelectJointMotion(){
      const messageElements = document.querySelectorAll('.SelectJointMotionMessage');
      messageElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      
      const {robotSceneManager} = this.props;
      const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return ;
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return ;
      let current = this.dropdownRef[0].current;
      if (current && current.props && current.props.value) {
        let value:string = current.props.value.value;
        let text:string = current.props.value.label;
        let joint_motion = robotSceneManager.getJointMotionById(value);
        console.log(joint_motion);
        if(joint_motion === undefined) return;
        let table = AnimationTable.createTableWithJointMotion(currRobot.name(), joint_motion.time, joint_motion.motion);
        this.props.robotSceneManager.addAnimationTable(table);
        if (this.props.animationManager.animationGroups.length === 0) {
          this.props.animationManager.addStoredAnimation(
            new AnimationGroup()
          );
        }
        console.log(table)
        for (const [i, group] of enumerate(this.props.animationManager.animationGroups())) {
          let prev_animation = LoadAndSavePanel.deleteAnimationAssociatedwithRobot(group, currRobot);
          if(prev_animation !== undefined){ // need to retrieve the descmap as we only bind the joint angle map here
            let prev_table = prev_animation.animationTable();
            table.setDescMap(prev_table.descMap());
          }
          console.log(table);
          group.addAnimation(new Animation(currRobot, table));
          // Activate the group (because otherwise people forget to).
          if (this.props.animationManager.activeAnimations().indexOf(group) === -1) {
            // Activate the group
            this.props.animationManager.addActiveAnimation(group);
          }
        }
        this.props.robotSceneManager.activateRobotScene(currScene);

        const successMessage = `Joint Motion Binded Successfully!`;
        const successElement = document.createElement("p");
        successElement.innerText = successMessage;
        successElement.classList.add("SelectJointMotionMessage"); // Optional: Add additional styles to the success message

        const panelElement = document.querySelector(".RobotOptionPanel");
        const loadRobotElement = panelElement?.querySelector(".Select-JointMotion");
        loadRobotElement?.appendChild(successElement);
      }
      else {
        const errorMessage = 'Error binding joint';
        const errorElement = document.createElement('p');
        errorElement.innerText = errorMessage;
        errorElement.style.color = 'red';  // Example of adding a style
        errorElement.classList.add("SelectJointMotionMessage");
        const panelElement = document.querySelector('.RobotOptionPanel');
        const loadRobotElement = panelElement?.querySelector(".Select-JointMotion");
        loadRobotElement?.appendChild(errorElement);
      }
    }

    /**
     * check whether the joint_motion and robot have the same joints
     * @param robot 
     * @param joint_motion 
     * @returns true if same
     */
    isChildJoint(robot: Robot, joint_motion: joint_motion_data): boolean{
      let jointMap = robot.getArticuatedJointMap();
      //console.log(jointMap);

      // no need to match all the joints in the joint map
      // if(jointMap.size !== joint_motion.motion.size) return false;
      for(const joint of joint_motion.motion.keys()){
        if(!jointMap.has(joint)) return false;
      }
      return true;
    }

    /**
     * Generate options for joint motion dropdown
     * @returns 
     */
    genJointMotionOptions(){
      let result = [];
      const {robotSceneManager} = this.props;
      const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return [];
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return [];
      for(const [id, motion] of robotSceneManager.getAllJointMotions()){
        if(this.isChildJoint(currRobot, motion)){
          result.push({
            label: motion.name,
            value: motion.id,
          });
        }
      }       
      return result; 
  }


  onSelectTF(){
    const messageElements = document.querySelectorAll('.SelectTransformationMessage');
      messageElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    const {robotSceneManager} = this.props;
    const currScene = robotSceneManager.currRobotScene();
    if (currScene === undefined) return ;
    const currRobot = currScene.selectedRobot();
    if (currRobot === undefined) return ;
    let current = this.dropdownRef[1].current;
    if (current && current.props && current.props.value) {
      let value:string = current.props.value.value;
      let text:string = current.props.value.label;
      let tf = robotSceneManager.getTFById(value);
      if(tf === undefined) return;
      let table = AnimationTable.createTableWithTF(currRobot.name(), tf.time, tf.tfs);
      this.props.robotSceneManager.addAnimationTable(table);
      if (this.props.animationManager.animationGroups.length === 0) {
        this.props.animationManager.addStoredAnimation(
          new AnimationGroup()
      );
      }
      for (const [i, group] of enumerate(this.props.animationManager.animationGroups())) {
        let prev_animation = LoadAndSavePanel.deleteAnimationAssociatedwithRobot(group, currRobot);
        if(prev_animation !== undefined){ // need to retrieve the descmap as we only bind the joint angle map here
          let prev_table = prev_animation.animationTable();
          table.setAngleMap(prev_table.angleMap());
        }
        console.log(table);
        group.addAnimation(new Animation(currRobot, table));
        // Activate the group (because otherwise people forget to).
        if (this.props.animationManager.activeAnimations().indexOf(group) === -1) {
          // Activate the group
          this.props.animationManager.addActiveAnimation(group);
        }
      }
      this.props.robotSceneManager.activateRobotScene(currScene);
      const successMessage = `Transformation Binded Successfully!`;
      const successElement = document.createElement("p");
      successElement.innerText = successMessage;
      successElement.classList.add("SelectTransformationMessage"); // Optional: Add additional styles to the success message

      const panelElement = document.querySelector(".RobotOptionPanel");
      const loadRobotElement = panelElement?.querySelector(".Select-Transformation");
      loadRobotElement?.appendChild(successElement);
    }
    else {
      const errorMessage = 'Error binding transformation';
      const errorElement = document.createElement('p');
      errorElement.innerText = errorMessage;
      errorElement.style.color = 'red';  // Example of adding a style
      errorElement.classList.add("SelectTransformationMessage");
      const panelElement = document.querySelector('.RobotOptionPanel');
      const loadRobotElement = panelElement?.querySelector(".Select-Transformation");
      loadRobotElement?.appendChild(errorElement);
    }
  }

  /**
     * check whether the tf belongs to this robot by checking whether their first link matches
     * @param robot 
     * @param joint_motion 
     * @returns true if same
     */
  isRobotTf(robot: Robot, tf: tf_data): boolean{
    let first_link = robot.links()[0].getLinkName();
    return first_link === tf.first_link;
  }

  /**
     * Generate options for tf dropdown
     * @returns 
     */
  genTFOptions(){
    let result = [];
    const {robotSceneManager} = this.props;
    const currScene = robotSceneManager.currRobotScene();
    if (currScene === undefined) return [];
    const currRobot = currScene.selectedRobot();
    if (currRobot === undefined) return [];
    for(const [id, tf] of robotSceneManager.getAllTFs()){
      if(this.isRobotTf(currRobot, tf)){
        result.push({
          label: tf.name,
          value: tf.id,
        });
      }
    }       
    return result; 
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

    onShowRobot(event:React.FormEvent<HTMLInputElement>) {
      const { robotSceneManager } = this.props;
      const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return;
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return;
      currRobot.setVisible(event.currentTarget.checked);
      APP.updateUI();
    }

    onOpacityChange(): (newValue:number) => void  {
      return (newValue:number) => {
        const { robotSceneManager } = this.props;
        const currScene = robotSceneManager.currRobotScene();
        if (currScene === undefined) return;
        const currRobot = currScene.selectedRobot();
        if (currRobot === undefined) return;
        currRobot.setOpacity(newValue);
        this.forceUpdate(); // forces rerender so that the label above the slider can update
      }
    }

    onShowData()
    {
      this.setState({
        show_data: !this.state.show_data
      });
    }
    // check if time has changed in render manually
    render() {
        //const isTimeWarp = this.props.isTimeWarp;
        const {robotSceneManager} = this.props;
        const currScene = robotSceneManager.currRobotScene();
      if (currScene === undefined) return (
        <div className={"RobotOptionPanel"} key={newID(4)}>
          This tab is for selecting which robot (if any)
          you would like. You do not have an robot selected currently,
          so this cannot be done. Please select an robot.
        </div>
      );
      const currRobot = currScene.selectedRobot();
      if (currRobot === undefined) return (
        <div className={"RobotOptionPanel"} key={newID(4)}>
          This tab is for selecting which robot (if any)
          you would like. You do not have an robot selected currently,
          so this cannot be done. Please select an robot.
        </div>
      );
        // if(this.props.currScene === undefined || this.props.currRobot === undefined)
        // {
        //     return (
        //       <div className={"RobotOptionPanel"} key={newID(4)}>
        //                 This tab is for selecting which robot (if any) 
        //                 you would like. You do not have an robot selected currently, 
        //                 so this cannot be done. Please select an robot.
        //             </div>
        //     );
        // }
        // const {currScene, currRobot} = this.props;
        let opacity = currRobot.opacity();

        return (
          <div className={"RobotOptionPanel"} ref={this._graphDiv}>
            <div className="PopUpGroup">
              <LabeledTextInput
                labelValue="Name:"
                value={currRobot.name()}
                onReturnPressed={(currValue) => {
                  currRobot.setName(currValue);
                }}
              />
              <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.RobotOptionPanel)}>
                <FontAwesomeIcon className="Icon" icon={faQuestion} />
              </button>
            </div>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Robot Appearance
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div className="RobotSelectorPanel">
                      <div className="RobotPanel" style={{ marginBottom: "10px" }}>
                        <div className="row-container">
                          <label>Show Object</label>
                          <label className="switch-left-label"> Show</label>
                          <Switch
                            checked={currRobot.visible()}
                            onChange={this.onShowRobot}
                          />
                          <label className="switch-right-label"> Hide </label>
                        </div>
                        <LabeledSlider
                          label={"Robot Opacity"}
                          min={-0.01}
                          step={0.01}
                          max={1}
                          value={opacity}
                          onChange={this.onOpacityChange()}
                          key={"Robot Opacity"}
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
                    Edit Object Positions/Robot Joints
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <RobotJointsPanel
                      robotScene={currScene}
                      robot={currRobot}
                    />
                  }
                </AccordionItemPanel>
              </AccordionItem>
            </Accordion>
            <Accordion allowZeroExpanded allowMultipleExpanded>
              <AccordionItem>
                <AccordionItemHeading>
                  <AccordionItemButton style={{ fontWeight: "bold" }}>
                    Edit Motion Data
                  </AccordionItemButton>
                </AccordionItemHeading>
                <AccordionItemPanel>
                  {
                    <div>
                      <div className="top-line">
                        <AnimationEditor
                          robotScene={currScene}
                          animationManager={this.props.animationManager}
                          robotSceneManager={this.props.robotSceneManager}
                          robot={currRobot}
                        />

                        <input type="button" value="show raw data" onClick={this.onShowData.bind(this)} style={{ marginTop: "1rem" }} />
                        {this.state.show_data && <DataTable
                          robotScene={currScene}
                          animationManager={this.props.animationManager}
                          robotSceneManager={this.props.robotSceneManager}
                          robot={currRobot}
                        />}
                      </div>
                      <div className="top-line">
                        <div className={"Select-JointMotion"}>
                          <label>Available Joint Motions </label>

                          <div className={"Select-container"}>
                            <Select
                              placeholder={"Select a joint motion ..."}
                              options={this.genJointMotionOptions()}
                              ref={this.dropdownRef[0]}
                              isSearchable={true}
                              styles={selectStyles}
                            />
                          </div>
                          <label>  </label>

                          <input type="button" value="Confirm" onClick={this.onSelectJointMotion.bind(this)} />
                        </div>
                        <div className={"Select-Transformation"}>
                          <label>Available Transformations</label>

                          <div className={"Select-container"}>
                            <Select
                              placeholder={"Select a transformation"}
                              options={this.genTFOptions()}
                              ref={this.dropdownRef[1]}
                              isSearchable={true}
                              styles={selectStyles}
                            />
                          </div>
                          <label>  </label>

                          <input type="button" value="Confirm" onClick={this.onSelectTF.bind(this)} />
                        </div>
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