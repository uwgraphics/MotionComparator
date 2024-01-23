import DockLayout from "rc-dock";
import { Component, ReactElement } from "react";
import { ModalPlacements } from "../../constants";
import { enumerate, newID } from "../../helpers";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene } from "../../scene/RobotScene";
import { DragButton } from "../DragButton";
import { panel_props } from "./panel";


export interface scene_selector_panel_props extends panel_props {
    modalType?: ModalPlacements,
    canEdit?: boolean,
    onRemoveRobotScene?: (robotScene:RobotScene) => void, 
    getParentDockLayout: () => DockLayout | undefined,
    robotSceneManager: RobotSceneManager,
}

interface scene_selector_panel_state {
}

/**
 * A panel that allows the selection of a RobotScene from a RobotSceneManager.
 */
export class SceneSelectorPanel extends Component<scene_selector_panel_props, scene_selector_panel_state> {
    constructor(props:scene_selector_panel_props) {
        super(props);

        this.state = {
            expanded: false,
        }
    }

    genGoToSceneCallback = (selectedScene:RobotScene) => {
        return () => {
            this.props.robotSceneManager.setCurrRobotScene(selectedScene);
        }
    }

    // React Methods

    render() {
        const table:ReactElement<HTMLTableRowElement>[] = [];
        const sceneManager = this.props.robotSceneManager;
        const currScene = sceneManager.currRobotScene();
        const currSceneData = currScene ? sceneManager.getManagedRobotSceneData(currScene) : undefined;

        // let longestPath = 0;

        // for (const [path,,] of sceneManager.content()) {
        //     longestPath = Math.max(path.length, longestPath);
        // }

        // let newButton = (i: number, value:string, robotScene:RobotScene, shouldcolor: boolean, currentScene: boolean) => {

        //     return (
        //         <DragButton
        //             key={`${value} ${i}`}
        //             className={currentScene ? "selectedRobot" : ""}
        //             buttonValue={value}
        //             getParentDockLayout={this.props.getParentDockLayout}
        //             onClick={this.genGoToSceneCallback(robotScene)}
        //             style={ shouldcolor ? { "borderColor": robotScene.color() } : {} }
        //             onDragStart={() => {
        //                 sceneManager.setAllowRobotSelection(false);

        //                 let common = () => {
        //                     sceneManager.setAllowRobotSelection(true);
        //                     sceneManager.activateRobotScene(robotScene);
        //                     sceneManager.setCurrRobotScene(robotScene);
        //                 }

        //                 return [
        //                     // Tab ID
        //                     `RobotScene&${newID(4)}&${robotScene.id().value()}`,

        //                     // onDrop Callback
        //                     (e) => {
        //                         common();
        //                     }
        //                 ];
        //             }}
        //         />
        //     );
        // }

        // for (const [i, [path, robotScene,]] of enumerate(this.props.robotSceneManager.content())) {
        //     let currentScene: boolean = currScene !== undefined && currScene === robotScene;
        //     let activeScene: boolean = this.props.robotSceneManager.isActiveRobotScene(robotScene);

        //     let tableRow:ReactElement<HTMLTableCellElement>[] = [];
        //     tableRow.push(
        //         <td key={`Col ${-1}`} className="sceneName">
        //             { newButton(i, robotScene.name(), robotScene, true, currentScene) }
        //         </td>
        //     );

        //     for (const [i, value] of enumerate(path)) {
        //         tableRow.push(
        //             <td key={`Col ${i}`}>
        //                 { newButton(i, value, robotScene, activeScene, currentScene) }
        //             </td>
        //         );
        //     }

        //     if (tableRow.length === 0) {
        //         tableRow.push(
        //             <td key={`Col ${-1}`}>
        //                     { newButton(0, "Unnamed Scene", robotScene, activeScene, currentScene) }
        //             </td>
        //         );
        //     }

        //     let j = 0;
        //     while (tableRow.length < longestPath) {
        //         tableRow.push(
        //             <td key={`Filler Col ${j}`}>
        //                 <label></label>
        //             </td>
        //         );
        //         j += 1;
        //     }

        //     table.push(
        //         <tr key={`Row ${i} ${robotScene.id().value()}`}>
        //             {tableRow}
        //         </tr>
        //     );
        // }

        // const buttonStyle = {
        //   fontSize: "15px",
        //   fontFamily: "'Roboto' , sans-serif",
        //   background: "hsla(124, 50%, 49%, 0.913)",
        //   padding: "0.5em 1em",
        //   borderRadius: "1em",
        //   border: "none",
        //   outline: "none",
        //   color: "white",
        //   cursor: "pointer",
        // };
        return (
            <div className="SceneSelectorPanel"> 
                { this.props.canEdit ? 
                    <div className="ButtonGroup" style={{display:"flex", gap: "10px"}}>
                        <input className="Button" type="button" value={"New Scene"} onClick={() => {
                            let _default = sceneManager.addDefaultManagedRobotScene();
                            sceneManager.setCurrRobotScene(_default);
                        }} />
                        <input className="Button" type="button" value={"Clone Scene"} onClick={(_) => {
                            if (currSceneData !== undefined) {
                                let clone = currSceneData.robotScene.clone(true, false, true);
                                sceneManager.addManagedRobotScenes([{
                                    path: [...currSceneData.path],
                                    robotScene: clone,
                                    metrics: new Map(currSceneData.metrics),
                                }]);
                            }
                        }} />

                    {/* { sceneManager.allManagedRobotScenes().length <= 1 ? null : 
                            <input type="button" value={"Delete Current Scene"} onClick={() => {
                                    let currScene = sceneManager.currRobotScene(true);
                                    if (currScene) {
                                        sceneManager.removeRobotScene(currScene);
                                        let onDelete = this.props.onRemoveRobotScene;
                                        if (onDelete) { onDelete(currScene); }
                                    }
                                }
                            } />
                    } */}
                    </div>
                 : null
                }

                {/* <div>
                    { 
                        table.length > 0 ? 
                            <table>
                                <tbody>
                                    { table }
                                </tbody>
                            </table>
                        : null
                    }
                </div> */}
            </div>
        );
    }
}