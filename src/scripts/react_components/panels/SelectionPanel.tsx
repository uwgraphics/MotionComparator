import DockLayout from "rc-dock";
import { Component } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from 'react-accessible-accordion';
import { RobotScene } from "../../scene/RobotScene";
import { GraphPanel } from "./GraphPanel";
import { Robot } from "../../objects3D/Robot";
import { SceneSelectorPanel } from "./SceneSelectorPanel";
import { DeleteButton } from "../DeleteButton";
import { newID } from "../../helpers";
import { DragButton } from "../DragButton";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { APP } from "../../constants";
import { PopupHelpPage } from "../popup_help_page";
import { Id } from "../../Id";

export interface selection_panel_props {
    getParentDockLayout: () => DockLayout | undefined,
    robotSceneManager: RobotSceneManager,
    // updateSelectionPanelState: (currScene?: RobotScene, currRobot?:Robot) => void,
    setSceneOptionPanelActive: () => void,
    setRobotOptionPanelActive: () => void,
}

interface selection_panel_state {
  selectedScenes: Map<string, boolean>, // cache the selected scenes
  selectedRobots: Map<string, boolean>, // cache the selected robots
}

/**
 * Panel for allowing the user to select what parts of the current Robot they want to trace.
 */
export class SelectionPanel extends Component<
  selection_panel_props,
  selection_panel_state
> {
  constructor(props: selection_panel_props) {
    super(props);
    this.state = {
      selectedScenes: new Map<string, boolean>(),
      selectedRobots: new Map<string, boolean>(),
    };
  }

  componentDidMount() {
    // Get references to the parent and child elements
    const parent = document.getElementById('SelectionPanel');
    const child = document.getElementById('group1');
    // Add event listeners to show/hide the child element
    if (parent && child) {
      // parent.addEventListener('mouseenter', () => {
      //   // Show the child element when the cursor enters the parent
      //   child.style.visibility = 'visible';
      // });

      // parent.addEventListener('mouseleave', () => {
      //   // Hide the child element when the cursor leaves the parent
      //   child.style.visibility = 'hidden';
      // });
      // parent.addEventListener('scroll', () => {
      //   // Update the child's position based on horizontal scroll
      //   const scrollLeft = parent.scrollLeft;
      //   child.style.right = `-${scrollLeft}px`;
      //   const scrollTop = parent.scrollTop;
      //   child.style.bottom = `-${scrollTop}px`;
      // });
    }
  }


  /**
   * Generate options for scene drop down
   * @returns
   */
  genSceneOptions() {
    let result = [];
    const rsmanager = this.props.robotSceneManager;
    for (const scene of rsmanager.allManagedRobotScenes()) {
      result.push({
        value: scene.id().value(),
        label: scene.name(),
      });
    }

    return result;
  }

  /**
   * Generate options for robots drop down
   * @returns
   */
  genRobotOptions(currScene: RobotScene | null) {
    // console.log("generate robot options!");
    let result = [];
    //const currScene = this.state.currScene;
    if (currScene != null) {
      for (const robot of currScene.robots()) {
        result.push({
          value: robot.id().value(),
          label: robot.name(),
          ghost: false,
        });
      }

      for (const robot of currScene.ghostRobots()) {
        result.push({
          value: robot.id().value(),
          label: robot.name() + "-ghost",
          ghost: true,
        });
      }
    }
    return result;
  }

  /**
   * Generate options for robot parts drop down
   * @returns
   */
  genRobotPartOptions(currScene: RobotScene | null, currRobotName: string) {
    // console.log("generate robot part options");
    // const currScene = this.state.currScene;
    if (currScene == null) return;
    // const currRobotName = this.state.currRobot.get(currScene.name());

    if (currRobotName != undefined) {
      const currRobot = GraphPanel.getRobotByName(currScene, currRobotName);
      if (currRobot?.objectType !== undefined)
        return this.genPartOptions(currRobotName, currRobot);
    }
  }
  /**
   * Generate part options for a specific robot
   * @param name
   * @param robot
   * @returns
   */
  genPartOptions(name: String, robot: Robot) {
    // console.log("generate part options!!");
    let result = [];
    if (robot.getArticuatedJointMap().size !== 0)
      result.push({
        value: "Articulated Joints",
        label: "Articulated Joints",
        id: "Articulated Joints",
        inScene: false,
        inGraph: false,
      });
    for (const [jointName, joint] of robot.getArticuatedJointMap()) {
      result.push({
        value: `${name}&${jointName}`,
        label: jointName,
        id: joint.id().value(),
        inScene: joint.isInScene(),
        inGraph: joint.isInGraph(),
      });
    }

    if (robot.getFixedJointMap().size !== 0)
      result.push({
        value: "Fixed Joints",
        label: "Fixed Joints",
        id: "Fixed Joints",
        inScene: false,
        inGraph: false,
      });
    for (const [jointName, joint] of robot.getFixedJointMap()) {
      result.push({
        value: `${name}&${jointName}`,
        label: jointName,
        id: joint.id().value(),
        inScene: joint.isInScene(),
        inGraph: joint.isInGraph(),
      });
    }

    if (robot.linkMap().size !== 0)
      result.push({
        value: "Links",
        label: "Links",
        id: "Links",
        inScene: false,
        inGraph: false,
      });
    for (const [jointName, joint] of robot.linkMap()) {
      result.push({
        value: `${name}&${jointName}`,
        label: jointName,
        id: joint.id().value(),
        inScene: joint.isInScene(),
        inGraph: joint.isInGraph(),
      });
    }
    // if (result.length !== 0) {
    //   // result.push({
    //   //   value: `${name}&all`,
    //   //   label: "all",
    //   //   inScene: false,
    //   //   inGraph: false,
    //   // });
    // } else {

    result.push({
      value: "Robot",
      label: "Robot",
      id: "Robot",
      inScene: false,
      inGraph: false,
    });
    result.push({
      value: `${name}&${name}`,
      label: `${name}`,
      id: robot.id().value(),
      inScene: robot.isInScene(),
      inGraph: robot.isInGraph(),
    });
    // }
    return result;
  }
  dragStartHandler(event: any) {
    event.dataTransfer.setData("text/plain", event.target.id);
  }
  /**
   * a helper function that appends the robot part options to render function
   * This must be done or the program will generate robot part options for
   * every robot in a given scene even though the users have not selected any robots
   * @param scene
   * @param robotName
   * @param robotValue
   * @returns undefined or ReactElement
   */
  appendRobotPartOptions(
    scene: RobotScene,
    robotName: string,
    robotValue: string
  ) {
    let robot_id = scene.id().value() + "#" + robotValue;
    let selected = this.state.selectedRobots.get(robot_id);
    if (selected === undefined || !selected) return undefined;
    else {
      return this.genRobotPartOptions(scene, robotName)?.map((robotPart) => (
        <AccordionItemPanel
          key={robotPart.id}
          // id={scene.id().value() + "#" + robotPart.value}
        >
          {this.genRobotPartList(scene, robotPart)}
          
        </AccordionItemPanel>
      ));
    }
  }

  /**
   * generate the robot part list displayed in the Selection Panel
   * @param scene 
   * @param robotPart 
   * @returns 
   */
  genRobotPartList(scene: RobotScene, robotPart: {value: string; label: string; inScene: boolean;inGraph: boolean;})
  {
    if(robotPart.value === "Articulated Joints" || robotPart.value === "Fixed Joints" || robotPart.value === "Links" || robotPart.value === "Robot")
    {
      return <div>{robotPart.value}</div>
    }
    return <div style={{ marginLeft: "-10px", display: "inline-block", whiteSpace: "nowrap" }}>
            {robotPart.inScene && <span>S&nbsp;</span>}
            {!robotPart.inScene && <span>&nbsp; &nbsp;</span>}
            {robotPart.inGraph && <span>G&nbsp;</span>}
            {!robotPart.inGraph && <span>&nbsp; &nbsp;</span>}
            <button
              className={"DragButton_RobotPart"}
              title="Click and drop it to a 3D scene or a 2D graph to see its traces"
              id={scene.id().value() + "#" + robotPart.value}
              draggable="true"
              onDragStart={this.dragStartHandler}
            >
              {robotPart.label}
            </button>
          </div>
  }


  /**
   * handle the event that the user click the Robot button
   * @param currScene 
   * @param selectedRobot 
   * @param event 
   */
  onSelectRobot(currScene: RobotScene | undefined, selectedRobot: Robot | undefined, event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.stopPropagation();
    this.props.setRobotOptionPanelActive();
    if(currScene === undefined) return;
    this.props.robotSceneManager.setCurrRobotScene(currScene);
    if (!this.props.robotSceneManager.isActiveRobotScene(currScene)) {
      this.props.robotSceneManager.activateRobotScene(currScene);
    }
    if(selectedRobot === undefined) return;
    currScene.setSelectedRobot(selectedRobot);
  }

  /**
   * a helper function that appends the robot options to render function
   * This must be done or the program will generate robot options for
   * every scene even though the users have not selected any scenes
   * @param scene
   * @returns undefined or ReactElement
   */
  appendRobotOptions(scene: RobotScene) {
    let selected = this.state.selectedScenes.get(scene.id().value());
    if (selected === undefined || !selected) return undefined;
    else {
      return (
        <Accordion
          allowZeroExpanded
          allowMultipleExpanded
          onChange={this.onChangeRobot.bind(this)}
        >
          {this.genRobotOptions(scene).map((robot) => (
            <AccordionItem
              uuid={scene.id().value() + "#" + robot.value}
              key={scene.id().value() + "#" + robot.value}
            >
              <AccordionItemHeading>
                <AccordionItemButton>
                  <DeleteButton
                    // id={scene.id().value() + "#" + robot.label}
                    onClick={(event) =>
                      this.onDelete(event, scene.id().value() + "#" + robot.value, "robot", robot.ghost)
                    }
                  />
                  <button
                    className={"DragButton_Robot"}
                    title="Click and drop it to a 3D scene or a 2D graph to add a ghost"
                    id={scene.id().value() + "#" + robot.label}
                    draggable="true"
                    onDragStart={this.dragStartHandler}
                    onClick={(event) =>
                      this.onSelectRobot(scene,scene.robotById(robot.value), event)
                    }
                  >
                    {robot.label}
                  </button>
                </AccordionItemButton>
              </AccordionItemHeading>
              {this.appendRobotPartOptions(scene, robot.label, robot.value)}
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
  }

  /**
   * handle the change of robot
   * @param ids an array of ids that are currently selected (expanded)
   */
  onChangeRobot(ids: string[]) {
    const copiedRobots = new Map<string, boolean>();
    for (const id of ids) {
      copiedRobots.set(id, true);
    }
    this.setState({
      selectedRobots: copiedRobots,
    });
  }
  /**
   * handle the change of scenes
   * @param ids an array of ids that are currently selected (expanded)
   */
  onChangeScene(ids: string[]) {
    const copiedScenes = new Map<string, boolean>();
    for (const id of ids) {
      copiedScenes.set(id, true);
    }
    this.setState({
      selectedScenes: copiedScenes,
    });
  }

  /**
   * Handle delete button clicks
   * @param event
   */
  onDelete(event: React.MouseEvent<HTMLButtonElement, MouseEvent>, id: string, type: string, ghost?: boolean) {
    // console.log("on delete id: " + id);
    event.stopPropagation();
    const { robotSceneManager } = this.props;
    if(type === "scene")
    {
      let scene = this.props.robotSceneManager.robotSceneById(id);
      if (scene) robotSceneManager.removeRobotScene(scene);
    }
    else if(type === "robot")
    {
      const [sceneId, robotId] = id.split("#");
      let scene = this.props.robotSceneManager.robotSceneById(sceneId);
      if (scene) {
        if (ghost !== undefined && ghost === true) {
          scene.removeGhostRobot(robotId);
        }
        else {
          let robot = scene.robotById(robotId);
          if (robot) scene.removeChildRobot(robot);
        }
      }
    }
  }



  /**
   * handle the event that the user click the Scene
   * @param selectedScene 
   * @param event 
   * @returns 
   */
  genGoToSceneCallback = (selectedScene: RobotScene, event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.stopPropagation();
    return () => {
      this.props.robotSceneManager.setCurrRobotScene(selectedScene);
      console.log("shit");
      if(!this.props.robotSceneManager.isActiveRobotScene(selectedScene))
      {
        console.log("hello");
        this.props.robotSceneManager.activateRobotScene(selectedScene);
      }
        
    };
  };

  onSelectScene(selectedScene: RobotScene,event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.stopPropagation();
    // console.log("event name" + event);
    // console.log(selectedRobot?.name());
    this.props.robotSceneManager.setCurrRobotScene(selectedScene);
    if (!this.props.robotSceneManager.isActiveRobotScene(selectedScene)) {
      this.props.robotSceneManager.activateRobotScene(selectedScene);
    }
    this.props.setSceneOptionPanelActive();
  }
  render() {
    const { selectedScenes } = this.state;
    const rsmanager = this.props.robotSceneManager;
    let scenes = rsmanager.allManagedRobotScenes();
    return (
      <div className={"SelectionPanel"} id={"SelectionPanel"}>
          
        <div style={{ marginBottom: "10px"}} id="group1" className="PopUpGroup">
          <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.SelectionPanel)}>
            <FontAwesomeIcon className="Icon" icon={faQuestion} />
          </button>
          <SceneSelectorPanel
            getParentDockLayout={this.props.getParentDockLayout}
            canEdit={true}
            robotSceneManager={rsmanager}
          />
        </div>
        {/* <Accordion allowZeroExpanded allowMultipleExpanded>
          <AccordionItem>
            <AccordionItemHeading>
              <AccordionItemButton>
                <span style={{marginLeft:"15px"}}>Usage</span>
              </AccordionItemButton>
            </AccordionItemHeading>
            <AccordionItemPanel>
              <div>
                Expand each scene to see its robots.
                <br/>
                <br/>
                Drag&drop the scene button to see the 3d view of the scene.
                <br/>
                <br/>
                Expand each robot to see its robot parts.
                <br/>
                <br/>
                Drag&drop the robot part button to the 3d view to see its traces.
                <br/>
                <br/>
                Drag&drop the robot part button to the 2d graph to see its data.
              </div>

            </AccordionItemPanel>
          </AccordionItem>
        </Accordion> */}
        <Accordion
          allowZeroExpanded
          allowMultipleExpanded
          onChange={this.onChangeScene.bind(this)}
        >
          {scenes.map((scene) => (
            <AccordionItem uuid={scene.id().value()} key={scene.id().value()}>
              <AccordionItemHeading>
                <AccordionItemButton>
                  <DeleteButton
                    id={scene.id().value()}
                    onClick={(event) =>
                      this.onDelete(event, scene.id().value(), "scene")
                    }
                  />
                  <DragButton
                    key={`${scene.name()}`}
                    title={"Click and drag to open the scene"}
                    className={"Scene"}
                    buttonValue={scene.name()}
                    getParentDockLayout={this.props.getParentDockLayout}
                    onClick={(event) =>/*this.genGoToSceneCallback(scene, event)*/ this.onSelectScene(scene, event)}
                    onDragStart={() => {
                      rsmanager.setAllowRobotSelection(false);

                      let common = () => {
                        rsmanager.setAllowRobotSelection(true);
                        if(!rsmanager.isActiveRobotScene(scene))
                          rsmanager.activateRobotScene(scene);
                        rsmanager.setCurrRobotScene(scene);
                      };

                      return [
                        // Tab ID
                        `RobotScene&${newID(4)}&${scene.id().value()}`,

                        // onDrop Callback
                        (e: any) => {
                          common();
                        },
                      ];
                    }}
                  />
                </AccordionItemButton>
              </AccordionItemHeading>
              <AccordionItemPanel>
                {this.appendRobotOptions(scene)}
              </AccordionItemPanel>
            </AccordionItem>
          ))}
        </Accordion>
        
      </div>
    );
  }
}