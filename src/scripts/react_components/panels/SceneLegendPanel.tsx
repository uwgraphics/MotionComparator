import { Component, createRef } from "react";
import * as d3 from 'd3'; 
import { genSafeLogger } from "../../helpers";
import _ from 'lodash';
import { Graph } from "../../objects3D/Graph";
import { RobotScene } from "../../scene/RobotScene";
import { Trace } from "../../objects3D/Trace";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotJoint } from "../../objects3D/RobotJoint";
import { RobotLink } from "../../objects3D/RobotLink";
import { Arrow } from "../../objects3D/Arrow";

interface legend_props {
    robotSceneManager: RobotSceneManager,
    robotScene: RobotScene,
}

interface legend_state {
    margin: margin_obj,
    prev_lines: Map<string, any>, //map line ids to line "object"
    panelWidth: number, // width of panel captured by resize observer
    panelHeight: number, // height of panel captured by resize observer
}
interface margin_obj{
    top: number,
    right: number, 
    bottom: number, 
    left: number 
}
export class SceneLegendPanel extends Component<legend_props, legend_state> {
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected _panel_resize_observer?: ResizeObserver;
    protected w: number;
    protected h: number;
    constructor(props:legend_props){
        super(props);
        this._graphDiv = createRef();
        this.drawGraph.bind(this);
        // const [line_names, line_ids, line_colors] = this.createLineNames();
        this.state = {
            margin: {
                top: 20,
                right: 60, 
                bottom: 40, 
                left: 60, // should be careful with this value as it can mess up the value along y axis
            },
            prev_lines: new Map<string, any>(),
            // line_names: line_names,
            // line_ids: line_ids,
            // line_colors: line_colors,
            panelHeight: 0,
            panelWidth: 294,
        };

        this.w = 0;
        this.h = 0;
    }
    componentWillUnmount() {
        if (this._panel_resize_observer) {
          this._panel_resize_observer.disconnect();
        }
    }
    componentDidMount(): void {
        this._panel_resize_observer = new ResizeObserver((entries)=>{
            // console.log("width should be " + entries[0].contentRect.width);
            this.setState({
                panelWidth: (entries[0].contentRect.width),
                panelHeight: (entries[0].contentRect.height),
            });
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            let svg = this.drawGraph(entries[0].contentRect.width, entries[0].contentRect.height);
            // console.log("width is " + this.w);
            if(svg){
                d3.select(this._graphDiv.current)
                    .append("svg")
                    .attr("width", this.w)
                    .attr("height", this.h)
                    .node().appendChild(svg);
            }
        });
        if(this._graphDiv && this._graphDiv.current){
            this._panel_resize_observer.observe(this._graphDiv.current);
        }
        if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
            this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
        }
        let svg = this.drawGraph(/*line_names, line_ids, line_colors*/);
        if(svg){
            d3.select(this._graphDiv.current)
                .append("svg")
                .attr("width", this.w)
                .attr("height", this.h)
                .node().appendChild(svg);
        }
        
    }
    componentDidUpdate(prevProps:legend_props) {
        // const [line_names, line_ids, line_colors] = this.createLineNames();
        // let colorChange = !_.isEqual(new Set(this.state.line_colors), new Set(line_colors)) || this.state.line_colors.length !== line_colors.length;
        // let lineChange = !_.isEqual(new Set(this.state.line_names), new Set(line_names)) || this.state.line_names.length !== line_names.length;
        if (/*colorChange || lineChange*/ this.props.robotScene.update()) {
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            let svg = this.drawGraph(/*line_names, line_ids, line_colors*/);
            console.log("width " + this.w + " height " + this.h);
            // log(svg);
            if(svg){
                d3.select(this._graphDiv.current)
                    .append("svg")
                    .attr("width", this.w)
                    .attr("height", this.h)
                    .node().appendChild(svg);
            }
            this.props.robotScene.setUpdate(false);
            // this.drawGraph();
        }
        
    }

    onDeleteTraceHandler(line_id: string) {
        return () => {
            const content = line_id.split("&");
            const [ids, partName] = content;
            const [sceneId, robotId] = ids.split("#");
            const {robotScene, robotSceneManager} = this.props;
            let traceScene = robotSceneManager.robotSceneById(sceneId);
            if(traceScene === undefined) return;
            let robot = traceScene.robotById(robotId);
            if(robot === undefined) return;
            let robotPart: RobotJoint | RobotLink | undefined = robot.jointMap().get(partName);
            if(robotPart === undefined){
                robotPart = robot.linkMap().get(partName);
                if(robotPart === undefined)
                {
                    if(partName !== robot.name())
                        return;
                }
            };
            if(traceScene === robotScene)
                robotScene.removeChildTrace(robot, robotPart);
            else
                traceScene.removeGhostTracesFrom(robot, robotPart, robotScene);
        };
    }

    onDeleteArrowHandler(arrow_id: string) {
        return () => {
            this.props.robotScene.removeArrow(arrow_id);
        };
    }

    getTraceName(trace: Trace): string
    {
        let robot = trace.robot(), robotPart = trace.robotPart();
        const name = robot.parentScene()?.name() + "_" + robot.name() + "_" + robotPart?.name();
        return name;
    }
    createLineNames(traces: Trace[], arrows: Arrow[]): [string[], string[], string[], string[], string[], string[]]
    {
        let trace_names: string[] = [], trace_ids: string[]  = [], trace_colors: string[]  = [],
        arrow_names: string[] = [], arrow_ids: string[] = [], arrow_colors:string[] = [];
        const {robotScene,} = this.props;
        for(const trace of traces)
        {
            let robot = trace.robot(), robotPart = trace.robotPart();
            let name = robot.parentScene()?.name() + "_" + robot.name() + "_" + robotPart?.name();
            let id = robot.parentScene()?.id().value() + "#" + robot.id().value() + "&" + robotPart?.name();
            if(robotPart === undefined)
            {
                name = robot.parentScene()?.name() + "_" + robot.name() + "_" + robot.name();
                id = robot.parentScene()?.id().value() + "#" + robot.id().value() + "&" + robot.name();
            }
            const color = trace.color();
            trace_names.push(name);
            trace_ids.push(id);
            trace_colors.push(color);
        }

        for(const arrow of arrows)
        {
            const name = "From " + this.getTraceName(arrow.traceFrom()) + " to " + this.getTraceName(arrow.traceTo());
            const id = arrow.id();
            const color = arrow.color();
            arrow_names.push(name);
            arrow_ids.push(id);
            arrow_colors.push(color);
        }
        return [trace_names, trace_ids, trace_colors, arrow_names, arrow_ids, arrow_colors];
    }
   
    /**
     * draw the legend using d3
     * @returns 
     */
    drawGraph(newPanelWidth?: number, newPanelHeight?: number):any{
        
        const {robotScene,} = this.props;
        
        const {margin, prev_lines, panelHeight, panelWidth} = this.state;
        let traces = robotScene.getAllTraces(), arrows = robotScene.getAllArrows();
        const [traces_names, traces_ids, traces_colors, arrows_names, arrows_ids, arrows_colors] = this.createLineNames(traces, arrows);
        const width = (newPanelWidth === undefined) ? panelWidth : newPanelWidth,
        height = (newPanelHeight === undefined) ? panelHeight : newPanelHeight;
        const legendW = width;
        // create svg component
        let svg = d3.select(this._graphDiv.current).append("svg").remove()
            .attr("width", width)
            .attr("height", height)
            .append("g");
            // .attr("transform", `translate(${margin.left},     ${margin.top})`);

        //draw legend

        const legend_start_x = 0;
        const legend_start_y = 0;
        // svg
        //     .append("rect")
        //     .attr("x", legend_start_x)
        //     .attr("y", legend_start_y)
        //     .attr("width", legendW)
        //     .attr("height", 50 * (traces_names.length + 1) + 35)
        //     // .attr("stroke", "#ccc")
        //     // .attr("fill-opacity", "75%")
        //     .style("fill", "rgb(23, 24, 25)");
        // svg
        //     .append("text")
        //     .attr("fill", "white")
        //     .attr("text-anchor", "middle")
        //     .attr("x", legend_start_x + legendW / 2)
        //     .attr("y", 30 + legend_start_y)
        //     .style("font-weight", 600)
        //     .style("font-size", "16px")
        //     .text("Legend");
        let legend_y = 5 + legend_start_y;


        // append the header "Traces:"
        svg
            .append("foreignObject")
            .attr("x", legend_start_x + 15)
            .attr("y", legend_y)
            .attr("width", 50) // Set the maximum width for text wrapping
            .attr("height", 30)
            .append("xhtml:div")
            .style("font-weight", 600)
            .style("font-size", "13px")
            .style("max-width", "100%")
            .style("color", "white") // Set the text color
            .html(
                `<p style="word-wrap: break-word; margin: 0;">Traces:</p>`
            );

        // Create right-click context menu

        const contextMenu = svg
            .append("g")
            .attr("class", "context-menu")
            .style("display", "none");

        document.addEventListener("click", () => {
            // Hide the context menu
            contextMenu.style("display", "none");
        });

        const option_width = 140,  // the width and height of an right-click menu option
            option_height = 20,
            padding_left = 60;
        // const start_x = -70,  // the offset of the option
        //     start_y = -15;
        const option1 = contextMenu
            .append("g") // Create a group element
            .attr("class", "option")
            // .attr("transform", `translate(${start_x},${start_y})`)
            .style("cursor", "pointer")
            .on("click", () => {
                // Option 1 click handler
                console.log("Option 1 clicked");
            });

        option1
            .append("rect")
            .attr("width", option_width)
            .attr("height", option_height)
            .attr("fill", "white");

        option1
            .append("text")
            .attr("x", padding_left)
            .attr("y", option_height / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-size", "12px")
            .style("fill", "black")
            .text("Select for compare");

        const option2 = contextMenu
            .append("g") // Create a group element
            .attr("class", "option")
            .attr(
                "transform",
                `translate(0,${option_height})`
            )
            .style("cursor", "pointer")
            .on("click", () => {
                // Option 2 click handler
                console.log("Option 2 clicked");
            });

        option2
            .append("rect")
            .attr("width", option_width)
            .attr("height", option_height)
            .attr("fill", "white");

        option2
            .append("text")
            .attr("x", option_width / 2)
            .attr("y", option_height / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-size", "12px")
            .style("fill", "black")
            .text("Compare with selected");

        // SVG icon markup
        const svgIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
    <!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
    <path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"/>
  </svg>
`;
        const radius = 8; // radius of the circle
        const xSize = 8; // the size of the "X"
        const gap = 5; // gap between lines
        legend_y += 30;
        for (let i = 0; i < traces_names.length; i++) {

            svg
                .append("circle")
                // .attr("class", "x label")
                .attr("fill", traces_colors[i])
                .attr("cx", legend_start_x + 15)
                .attr("cy", legend_y)
                .attr("r", radius);

            let traces_name = traces_names[i];

            
            // draw "X". Whenever the user clicks it, it remove the current line in the graph
            const x_offset = 0.99 * legendW - 2 * xSize; //272
            // Create a foreignObject element to embed the icon
            let trashIcon = svg.append("foreignObject")
                .attr("x", legend_start_x + x_offset) // Adjust the x position of the icon
                .attr("y", legend_y - xSize) // Adjust the y position of the icon
                .attr("width", 15) // Adjust the width of the icon container
                .attr("height", 17) // Adjust the height of the icon container
                .attr("class", "white-icon") // Add the CSS class for white color
                .style("cursor", "pointer") // Set the cursor to "pointer" when hovering
                .on("click", this.onDeleteTraceHandler(traces_ids[i]));
            // Add the SVG icon markup to the foreignObject element
            trashIcon.html(svgIcon);

            
            // const line1 = svg
            //     .append("line")
            //     .attr("x1", legend_start_x + x_offset)
            //     .attr("y1", legend_y - xSize)
            //     .attr("x2", legend_start_x + x_offset + 2 * xSize)
            //     .attr("y2", legend_y + xSize)
            //     .attr("stroke", "red")
            //     .attr("stroke-width", 2)
            //     .style("cursor", "pointer")
            //     .on("click", this.createOnClickHandler(line_ids[i]));

            // const line2 = svg
            //     .append("line")
            //     .attr("x1", legend_start_x + x_offset)
            //     .attr("y1", legend_y + xSize)
            //     .attr("x2", legend_start_x + x_offset + 2 * xSize)
            //     .attr("y2", legend_y - xSize)
            //     .attr("stroke", "red")
            //     .attr("stroke-width", 2)
            //     .style("cursor", "pointer")
            //     .on("click", this.createOnClickHandler(line_ids[i]));
            


            const c_length = 7; // the length of a single character
            const line_width = 0.9 * legendW - 2 * xSize - 2 * radius;
            const line_counts = Math.ceil(traces_name.length * c_length / line_width);
            const line_height = line_counts * 20;
            // console.log("line count: " + line_counts)
            // console.log("line height: " + line_height)
            const foreignObject = svg
                .append("foreignObject")
                .attr("x", legend_start_x + 25)
                .attr("y", legend_y - radius)
                .attr("width", line_width) // Set the maximum width for text wrapping
                .attr("height", line_height);
            // Set the height of the foreignObject
            ((trace: Trace) => {
                const div = foreignObject
                    .append("xhtml:div")
                    .style("font-weight", 600)
                    .style("font-size", "13px")
                    .style("max-width", "100%")
                    .style("color", traces_colors[i]) // Set the text color
                    .html(
                        `<p style="word-wrap: break-word; margin: 0;">${traces_name}</p>`
                    );

                div.on("contextmenu", (event: MouseEvent) => {
                    // Prevent default right-click event
                    event.preventDefault();

                    const svgElement = svg.node();
                    const svgRect = svgElement.getBoundingClientRect();

                    // Get the adjusted mouse coordinates relative to the SVG element
                    const mouseX = event.pageX - svgRect.left;
                    const mouseY = event.pageY - svgRect.top;

                    //   console.log(
                    //     "should be x: " +
                    //       (legend_start_x + 25) +
                    //       " y: " +
                    //       legend_y
                    //   );
                    //   console.log("x: " + mouseX + " y: " + mouseY);

                    // Position the context menu at the mouse coordinates
                    contextMenu.attr(
                        "transform",
                        `translate(${mouseX}, ${mouseY})`
                    );

                    // Show the context menu
                    contextMenu.style("display", "block");
                    option1.on("click", () => {
                        robotScene.setTraceFrom(trace);
                    });

                    option2.on("click", () => {
                        robotScene.setTraceTo(trace);
                    });

                    // Move the context menu container to the end of the SVG element's children
                    svg.node().appendChild(contextMenu.node());
                });
            }
            )(traces[i]);


            legend_y += line_height + gap;
        }

        // append the header "Difference between Traces:"
        if (arrows.length > 0) {
            svg
                .append("foreignObject")
                .attr("x", legend_start_x + 15)
                .attr("y", legend_y)
                .attr("width", 200) // Set the maximum width for text wrapping
                .attr("height", 30)
                .append("xhtml:div")
                .style("font-weight", 600)
                .style("font-size", "13px")
                .style("max-width", "100%")
                .style("color", "white") // Set the text color
                .html(
                    `<p style="word-wrap: break-word; margin: 0;">Difference between Traces:</p>`
                );
            legend_y += 30;
        }

        for (let i = 0; i < arrows_names.length; i++) {

            svg
                .append("circle")
                // .attr("class", "x label")
                .attr("fill", arrows_colors[i])
                .attr("cx", legend_start_x + 15)
                .attr("cy", legend_y)
                .attr("r", radius);

            let arrows_name = arrows_names[i];

            
            // draw "X". Whenever the user clicks it, it remove the current line in the graph
            const x_offset = 0.99 * legendW - 2 * xSize; //272
            // Create a foreignObject element to embed the icon
            let trashIcon = svg.append("foreignObject")
                .attr("x", legend_start_x + x_offset) // Adjust the x position of the icon
                .attr("y", legend_y - xSize) // Adjust the y position of the icon
                .attr("width", 15) // Adjust the width of the icon container
                .attr("height", 17) // Adjust the height of the icon container
                .attr("class", "white-icon") // Add the CSS class for white color
                .style("cursor", "pointer") // Set the cursor to "pointer" when hovering
                .on("click", this.onDeleteArrowHandler(arrows_ids[i]));
            // Add the SVG icon markup to the foreignObject element
            trashIcon.html(svgIcon);

            const c_length = 7; // the length of a single character
            const line_width = 0.9 * legendW - 2 * xSize - 2 * radius;
            const line_counts = Math.ceil(arrows_name.length * c_length / line_width);
            const line_height = line_counts * 20;
            // console.log("line count: " + line_counts)
            // console.log("line height: " + line_height)
            const foreignObject = svg
                .append("foreignObject")
                .attr("x", legend_start_x + 25)
                .attr("y", legend_y - radius)
                .attr("width", line_width) // Set the maximum width for text wrapping
                .attr("height", line_height);
            // Set the height of the foreignObject
            ((arrows: Arrow) => {
                const div = foreignObject
                    .append("xhtml:div")
                    .style("font-weight", 600)
                    .style("font-size", "13px")
                    .style("max-width", "100%")
                    .style("color", arrows_colors[i]) // Set the text color
                    .html(
                        `<p style="word-wrap: break-word; margin: 0;">${arrows_name}</p>`
                    );
            }
            )(arrows[i]);


            legend_y += line_height + gap;
        }
        
        // console.log("width should be " + width);
        this.w = width;
        this.h = 50 * (traces_names.length + arrows_names.length + 1) + 100;
        this.setState({
            // w: width,
            // h: 50 * (traces_names.length + arrows_names.length + 1) + 100,
            prev_lines: prev_lines,
        });
        return svg.node();
    }
    render() {
        let styles = {display: "inline-block", marginBottom: "10px"}
        return (
            <div>
                <div className="Legend" ref={this._graphDiv}>
                </div>
            </div>
        );
    }
}
