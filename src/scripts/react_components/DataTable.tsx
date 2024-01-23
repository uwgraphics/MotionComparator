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

export interface data_table_props {
    style?: React.CSSProperties | undefined,
    robotSceneManager: RobotSceneManager,
    animationManager: AnimationManager,
    robotScene: RobotScene,
    robot: Robot,
}

interface data_table_state {
}


export class DataTable extends React.Component<data_table_props, data_table_state> {
    protected _table: React.RefObject<HTMLButtonElement>;

    constructor(props:data_table_props) {
        super(props);

        this._table = React.createRef();
    }

    render() {
        console.log("render");
        const {animationManager, robotSceneManager, robot} = this.props;
        let animation: Animation | undefined;
        for (const [i, group] of enumerate(animationManager.animationGroups())) {
            for (const [j, anim] of enumerate(group.animations())) {
               if(anim.robot() === robot)
               {
                    animation = anim;
               }
            }
        }
        if(animation === undefined) return;
        let animation_table = animation.animationTable();
        let data = animation_table.toCSV().slice(0, 10);
        for(let i=0; i<data.length; i++)
            for(let j=0; j<data[i].length; j++)
            {
                if (!isNaN(Number(data[i][j]))) {
                    data[i][j] = Number(data[i][j]).toFixed(3);
                }
            }
        return (
            <div className="DataTable">
                <span>Note: The data table only shows the first 10 rows of the data</span>
                <table >

                    {/* <thead>
                    <tr>
                        {data.map((col) => (
                            <td>{col[0]}</td>
                        ))}
                    </tr>
                </thead> */}
                    <tbody>
                        {data.map((col, index) => (
                            <tr key={index}>
                                {
                                    col.map((entry, index) => (
                                        <td style={{ paddingRight: '10px' }}>{entry}</td>
                                    ))
                                }
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}