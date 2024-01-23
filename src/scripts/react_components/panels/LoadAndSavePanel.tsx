import { Component, createRef, ReactElement, RefObject } from "react";
import { FileUploader } from "../FileUploader";
import { APP } from "../../constants";
import { RobotScene } from "../../scene/RobotScene";
import { RobotSceneManager } from "../../RobotSceneManager";
import { panel_props } from "./panel";
import { saveToJson } from "../../save_functions";
import { AnimationTable } from "../../AnimationTable";
import {
    Accordion,
    AccordionItem,
    AccordionItemHeading,
    AccordionItemButton,
    AccordionItemPanel,
  } from 'react-accessible-accordion';
import { AnimationManager } from "../../AnimationManager";
import { enumerate } from "../../helpers";
import { Animation } from "../../Animation";
import { AnimationGroup } from "../../AnimationGroup";
import { Robot } from "../../objects3D/Robot";
import { LayoutBase } from "rc-dock";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import { PopupHelpPage } from "../popup_help_page";
import Select from 'react-select'
import { selectStyles } from "./SceneOptionPanel";

let exampleRobotURLs = [
    {"robot_name": "sawyer", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/sawyer/urdf/sawyer_gripper.urdf"},
    {"robot_name": "fetch", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/fetch/urdf/fetch.urdf"},
    {"robot_name": "mico", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/kinova/urdf/mico.urdf"},
    {"robot_name": "ur5", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/ur5/urdf/ur5_gripper.urdf"},
    {"robot_name": "spot arm", "url" : "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/spot_arm/urdf/spot_arm.urdf"},
    {"robot_name": "panda", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/robots/panda/urdf/panda.urdf"},
    {"robot_name": "bottle", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/objects/glass_bottle.glb"},
    {"robot_name": "table", "url": "https://raw.githubusercontent.com/uwgraphics/MotionComparator-Examples/main/objects/side_table.glb"},
    {"robot_name": "end-effector targets", "url": "EETarget"}
]

export interface load_and_save_panel_props extends panel_props{
    robotSceneManager:RobotSceneManager,
    animationManager: AnimationManager,
    // getParentDockLayout: () => DockLayout | undefined,
    onSaveLayout: () => LayoutBase | undefined,
    onRestoreLayout: (savedLayout: LayoutBase | undefined) => void,
}

export interface load_and_save_panel_state {
    savedLayout: LayoutBase | undefined,
 }


export class LoadAndSavePanel extends Component<load_and_save_panel_props, load_and_save_panel_state> {
    protected _urdfURLInput: RefObject<HTMLInputElement>;
    protected _jsonURLInput: RefObject<HTMLInputElement>;
    protected _importSceneURLInput: RefObject<HTMLInputElement>;
    protected _animationCsvUrlInput: RefObject<HTMLInputElement>;
    protected _exampleRobotInput: RefObject<HTMLSelectElement>;
    // protected _exampleRobotOptions: ReactElement<HTMLOptionElement>[] = [];
    protected _exampleRobotOptions: {value: string, label: string}[] = [];
    protected dropdownRef : any;

    constructor(props:load_and_save_panel_props) {
        super(props);
        this.state = {
            savedLayout: undefined
        };
        this.dropdownRef = createRef();
        //this.onUploadRobot = this.onUploadRobot.bind(this);
        this.onLoadURDFURL = this.onLoadURDFURL.bind(this);
        this.onUploadJsonScene = this.onUploadJsonScene.bind(this);
        this.onLoadAnimationCSV = this.onLoadAnimationCSV.bind(this);
        this.onLoadSession = this.onLoadSession.bind(this);
        this.onSaveSession = this.onSaveSession.bind(this);
        this.onUploadSession = this.onUploadSession.bind(this);
        this.onUploadAnimationCSV = this.onUploadAnimationCSV.bind(this);
        this.onUploadAnimationRosbag = this.onUploadAnimationRosbag.bind(this);
        this.onSelectExampleRobot = this.onSelectExampleRobot.bind(this);

        this.currScene = this.currScene.bind(this);

        this._animationCsvUrlInput = createRef<HTMLInputElement>();
        this._urdfURLInput = createRef<HTMLInputElement>();
        this._jsonURLInput = createRef<HTMLInputElement>();
        this._importSceneURLInput = createRef<HTMLInputElement>();
        this._exampleRobotInput = createRef<HTMLSelectElement>();

        // for (const robot of exampleRobotURLs) {
        //     let option = document.createElement("option");
        //     option.text = robot.robot_name;
        //     option.value = robot.url;
        //     this._exampleRobotOptions.push(
        //         <option key={robot.robot_name} value={robot.url}>{robot.robot_name}</option>
        //     )
        // }

        for (const robot of exampleRobotURLs) {
            this._exampleRobotOptions.push({
                value: robot.url,
                label: robot.robot_name,
            })
        }
    }

    protected currScene(): RobotScene {
        return this.props.robotSceneManager.currRobotScene(false);
    }

    /**
     * Objects and animations should be added to the current RobotScene by
     * adding them to the current StoredRobotScene (that way they can be applied
     * or removed easily later).
     */
    assureRobotScene():RobotScene {
        const robotSceneManager = this.props.robotSceneManager;
        let currRobotScene = robotSceneManager.currRobotScene(false);
        return currRobotScene;
    }

//    onUploadRobot(event:React.FormEvent<HTMLInputElement>) {
//        let jsonFileLoc:FileList | null = event.currentTarget.files;
//        if (jsonFileLoc) {
//            this.currScene().loadURDFFromLocalFile(jsonFileLoc);
//        } else {
//            APP.error(`Failed to upload the robot: No files to upload found!`);
//        }
//    }

    async onLoadURDFURL() {
        const messageElements = document.querySelectorAll('.LoadRobotMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        let current = this._urdfURLInput.current;
        if (current) {
            let url:string = current.value;
            if (url.length > 0) {
                let robot = await this.currScene().loadRobotFromURL(url);
                this.autoBindNewRobotwithAnimation(robot);
            } else {
                APP.error(`Failed to load the URDF file: The URL for the URDF file was empty.`);
            }
        }
    }

    onUploadJsonScene(event:React.FormEvent<HTMLInputElement>) {
        let jsonFileLoc:FileList | null = event.currentTarget.files;

        if (jsonFileLoc) {
            this.currScene().loadJsonFromLocalFile(jsonFileLoc[0]);
        }
    }

    /**
     * remove animations associated with robot in current group
     * @param group 
     * @param robot 
     */
    static deleteAnimationAssociatedwithRobot(group: AnimationGroup, robot: Robot): Animation | undefined
    {
        let animations = [...group.animations()];
        let animation;
        for(let i=0; i<animations.length; i++)
        {
            if(robot === animations[i].robot())
            {
                console.log("remove animations!!!!");
                group.removeAnimation(animations[i]);
                animation = animations[i];
          }                
        }
        return animation;
    }
    autoBindNewRobotwithAnimation(robot:Robot)
    {
        if (this.props.animationManager.animationGroups.length === 0) {
            this.props.animationManager.addStoredAnimation(
                new AnimationGroup()
            );
        }
        for (const [i, group] of enumerate(this.props.animationManager.animationGroups()))
        {
            for(const table of this.props.robotSceneManager.animationTables())
            {
                if(table.robotNames().has(robot.name())) // find animation table that contains
                {
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
    /**
     * automatically bind the new animation to the robots in the current scene
     * This function will be called whenever users upload or load a csv animation file
     * @param table the new animation table built from newly uploaded/loaded csv file
     */
    autoBindNewAnimationtoRobot(table: AnimationTable)
    {
        // console.log("auto bind new animation with robot!!!");
        let robotNames = table.robotNames();
        let absentRobots: Set<string> = new Set();
        let bindedRobots = "";
        for(const robot of robotNames)
            absentRobots.add(robot);

        for(const robot of this.currScene().robots())
        {
            // console.log(robot.name());
            if(robotNames.has(robot.name())) // find robot name
            {
                absentRobots.delete(robot.name());
                bindedRobots = bindedRobots + robot.name() + ", ";
                // console.log(this.props.animationManager.animationGroups());
                if (this.props.animationManager.animationGroups.length === 0) {
                    this.props.animationManager.addStoredAnimation(
                        new AnimationGroup()
                    );
                }
                for (const [i, group] of enumerate(this.props.animationManager.animationGroups()))
                {
                    LoadAndSavePanel.deleteAnimationAssociatedwithRobot(group, robot);
                    group.addAnimation(new Animation(robot, table));
                    // Activate the group (because otherwise people forget to).
                    if (this.props.animationManager.activeAnimations().indexOf(group) === -1) {
                      // Activate the group
                      this.props.animationManager.addActiveAnimation(group);
                    }
                }
            }
        }

        const panelElement = document.querySelector('.LoadAndSavePanel');
        const loadRobotElement = panelElement?.querySelector(".LoadCSV");
        if (bindedRobots.length > 0) {
            const successMessage = "Successfully bind " + bindedRobots;
            const successElement = document.createElement("p");
            successElement.innerText = successMessage;
            successElement.classList.add("LoadCSVMessage"); // Optional: Add additional styles to the success message
            loadRobotElement?.appendChild(successElement);
        }

        if(absentRobots.size > 0)
        {
            let absentRobotsNames = "";
            for (const robot of absentRobots)
                absentRobotsNames = absentRobotsNames + robot + ", ";
            const errorMessage = 'Cannot find robot ' + absentRobotsNames;
            const errorElement = document.createElement('p');
            errorElement.innerText = errorMessage;
            errorElement.style.color = 'red';  // Example of adding a style
            errorElement.classList.add("LoadCSVMessage");
            loadRobotElement?.appendChild(errorElement);
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
            let url:string = current.value;
            if (url.length > 0) {
                for (const table of await AnimationTable.loadFromURL(url, "LoadCSV")) {
                    this.props.robotSceneManager.addAnimationTable(table);
                    this.autoBindNewAnimationtoRobot(table);
                }
            } else {
                APP.error(`Failed to load the animation CSV file: The URL for the animation CSV file was empty!`);
            }
        }
        this.props.robotSceneManager.activateRobotScene(this.currScene());
    }

    async onUploadAnimationCSV(event:React.FormEvent<HTMLInputElement>):Promise<void> {
        const messageElements = document.querySelectorAll('.LoadCSVMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        let jsonFileLoc:FileList | null = event.currentTarget.files;

        if (jsonFileLoc) {
            for (const file of jsonFileLoc) {
                for (const table of await AnimationTable.loadFromLocalFile(file, "LoadCSV")) {
                    console.log(table);
                    this.props.robotSceneManager.addAnimationTable(table);
                    this.autoBindNewAnimationtoRobot(table);
                }
            }
        }
        this.props.robotSceneManager.activateRobotScene(this.currScene());
    }

    async onUploadAnimationRosbag(event:React.FormEvent<HTMLInputElement>):Promise<void> {
        const messageElements = document.querySelectorAll('.LoadRosbagMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        let jsonFileLoc:FileList | null = event.currentTarget.files;

        if (jsonFileLoc) {
            for (const file of jsonFileLoc) {
                await AnimationTable.parseRosbag(this.props.robotSceneManager, file, "LoadRosbag");
                // this.props.robotSceneManager.addAnimationTable(table);
                //this.autoBindNewAnimationtoRobot(table);
                // for (const table of await AnimationTable.parseRosbag(this.props.robotSceneManager,file)) {
                //     this.props.robotSceneManager.addAnimationTable(table);
                //     this.autoBindNewAnimationtoRobot(table);
                // }
            }
        }
        this.props.robotSceneManager.activateRobotScene(this.currScene());
    }

    async onUploadSession(event:React.FormEvent<HTMLInputElement>):Promise<void> {
        let jsonFileLoc:FileList | null = event.currentTarget.files;

        if (jsonFileLoc) {
            for (const file of jsonFileLoc) {
                this.props.robotSceneManager.loadSessionFromLocalFile(file, this.props.onRestoreLayout);
            }
        }
    }

    async onSaveSession():Promise<void> {
        let saveFormat = this.props.robotSceneManager.saveSession();
        saveFormat.layout = this.props.onSaveLayout();
        saveToJson(saveFormat, "session.json");
    }

    async onLoadSession():Promise<void> {
        let current = this._importSceneURLInput.current;
        if (current) {
            let url:string = current.value;
            if (url.length > 0) {
                this.props.robotSceneManager.loadSessionFromURL(url, this.props.onRestoreLayout);
            } else {
                APP.error(`Failed to load the sessions: The URL for the sessions was empty.`);
            }
        }
    }

    async onSelectExampleRobot():Promise<void> {
        const messageElements = document.querySelectorAll('.LoadRobotMessage');
        messageElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        // let current = this._exampleRobotInput.current;
        // if (current) {
        //     let text:string = current.options[current.selectedIndex].text;
        //     let value:string = current.value;
        //     if (value === "EETarget") {
        //         this.currScene().addEETarget();
        //     } else 
        //         if (value.length > 0) {
        //             this.currScene().loadRobotFromURL(value, text);
        //         } else {
        //             APP.error(`Failed to load the URDF file: The URL for the URDF file was empty.`);
        //     }
        // }

        let current = this.dropdownRef.current;
        if (current && current.props && current.props.value) {
            let text:string = current.props.value.label;
            let value:string = current.props.value.value;
            if (value === "EETarget") {
                this.currScene().addEETarget();
            } else 
                if (value.length > 0) {
                    this.currScene().loadRobotFromURL(value, text);
                } else {
                    APP.error(`Failed to load the URDF file: The URL for the URDF file was empty.`);
            }
        }
    }

    onSaveLayout()
    {
        let savedLayout = this.props.onSaveLayout();
        const serializedLayout = JSON.stringify(savedLayout);
        const parsedLayout: LayoutBase | undefined = JSON.parse(serializedLayout);
        console.log(parsedLayout);
        if(parsedLayout !== undefined)
        {
            this.setState({
                savedLayout: parsedLayout
            });
        }
    }

    // onRestoreLayout()
    // {
    //     let savedLayout = this.props.onSaveLayout();
    //     if(savedLayout !== undefined)
    //     {
    //         this.setState({
    //             savedLayout: savedLayout
    //         });
    //     }
    // }

    render() {
        return (
            <div className="LoadAndSavePanel">
                <div className="PopUpGroup">
                    <button id="open-popup" className="OpenPop" onClick={() => APP.setPopupHelpPage(PopupHelpPage.LoadAndSavePanel)}>
                        <FontAwesomeIcon className="Icon" icon={faQuestion} />
                    </button>
                </div>

                <br></br>
                {/* <div className="SaveAndRestoreLayout">
                    <button onClick={this.onSaveLayout.bind(this)}>Save Layout</button>
                    <button onClick={() => {this.props.onRestoreLayout(this.state.savedLayout)}}>Restore Layout</button>
                </div> */}
                <div className="top-line">
                    <label> <b> Workspace </b>  </label>
                    <div className="row-container">
                        <label> Upload a workspace: </label>
                        <FileUploader
                            accept={[".json"]}
                            vertical={false}
                            onChange={this.onUploadSession}
                        />
                    </div>
                    <div className="row-container">
                        <label> Load from a url: </label>
                        <input ref={this._importSceneURLInput} type="text" placeholder=" URL" />
                        <input type="button" value="Load" onClick={this.onLoadSession} />
                    </div>
                    <div className="row-container">
                        <label> Download current workspace: </label>
                        <input type="button" value="Download" onClick={this.onSaveSession} />
                    </div>
                </div>

                <div className="top-line">
                    <label> <b>  Mesh </b>  </label>

                    <div className="LoadRobot">
                        {/*<FileUploader 
                    label="Upload URDF"
                    vertical={true}
                    onChange={this.onUploadRobot}
                />*/}
                        <div className={"row-container"}>
                            <label>Example robots </label>

                            <div className={"select-container"}>
                                <Select
                                    placeholder={"Select a robot ..."}
                                    options={this._exampleRobotOptions}
                                    ref={this.dropdownRef}
                                    // onChange={this.onSelectExampleRobot.bind(this)}
                                    isSearchable={true}
                                    styles={selectStyles}
                                />
                            </div>
                          
                            <input type="button" value="Confirm" onClick={this.onSelectExampleRobot} />
                        </div>
                            
                        <div className="row-container">
                            <label>Load online URDF: </label>
                            <input ref={this._urdfURLInput} type="text" placeholder=" URL " />
                            <label>  </label>
                            <input type="button" value="Load" onClick={this.onLoadURDFURL} />
                        </div>
                        
                    </div>
                </div>
                <div className="top-line ">
                    <label> <b>  Motion </b>  </label>
                    <div className="row-container">
                        <label> Upload a CSV file </label>
                        {/* <label> <b> Note: the header of the CSV must be in this format robotName-robotPartName </b>  </label> */}
                        <FileUploader
                            accept={[".csv"]}
                            vertical={false}
                            onChange={this.onUploadAnimationCSV}
                        />
                    </div>

                    <div className="row-container">
                        <label>Load from a url: </label>
                        <input ref={this._animationCsvUrlInput} type="text" placeholder=" URL " />
                        <label>  </label>
                        <input type="button" value="Load" onClick={this.onLoadAnimationCSV} />
                    </div>


                    <div className="row-container">
                        <label> Upload a Rosbag: </label>
                        {/* <label> <b> Note: the header of the CSV must be in this format robotName-robotPartName </b>  </label> */}
                        <FileUploader
                            accept={[".bag"]}
                            vertical={false}
                            onChange={this.onUploadAnimationRosbag}
                        />

                        {/* <div className="row-container">
                            <label>Load from a url: </label>
                            <input ref={this._animationCsvUrlInput} type="text" placeholder=" URL " />
                            <label>  </label>
                            <input type="button" value="Load" onClick={this.onLoadAnimationCSV} />
                        </div> */}
                    </div>

                </div>
            
                {/*<input type="button" value="Export to GLTF" />*/}
            </div>
        );
    }
}