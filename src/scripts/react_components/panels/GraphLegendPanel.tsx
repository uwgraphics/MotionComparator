import { Component, createRef } from "react";
import * as d3 from 'd3'; 
import { genSafeLogger } from "../../helpers";
import _ from 'lodash';
import { Graph } from "../../objects3D/Graph";

interface legend_props {
    graph: Graph,
    updateLegendState: (graph_update?: boolean) => void,
}

interface legend_state {
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of ids of lines graphed
    line_colors: string[], //list of colors of lines graphed
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
export class GraphLegendPanel extends Component<legend_props, legend_state> {
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected _panel_resize_observer?: ResizeObserver;
    protected w: number;
    protected h: number;
    constructor(props:legend_props){
        super(props);
        this._graphDiv = createRef();
        this.drawGraph.bind(this);
        this.state = {
            margin: {
                top: 20,
                right: 60, 
                bottom: 40, 
                left: 60, // should be careful with this value as it can mess up the value along y axis
            },
            prev_lines: new Map<string, any>(),
            line_names: this.props.graph.lineNames(), //list of names of lines graphed
            line_ids: this.props.graph.lineIds(), //list of ids of lines graphed
            line_colors: this.props.graph.lineColors(), //list of colors of lines graphed
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
            this.setState({
                panelWidth: (entries[0].contentRect.width),
                panelHeight: (entries[0].contentRect.height),
            });
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            let svg = this.drawGraph(entries[0].contentRect.width, entries[0].contentRect.height);
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
        let svg = this.drawGraph();
        if(svg){
            d3.select(this._graphDiv.current)
                .append("svg")
                .attr("width", this.w)
                .attr("height", this.h)
                .node().appendChild(svg);
        }
        
    }
    componentDidUpdate(prevProps:legend_props) {
        let colorChange = !_.isEqual(new Set(this.state.line_colors), new Set(this.props.graph.lineColors())) || this.state.line_colors.length !== this.props.graph.lineColors().length;
        let lineChange = !_.isEqual(new Set(this.state.line_names), new Set(this.props.graph.lineNames())) || this.state.line_names.length !== this.props.graph.lineNames().length;
        if (colorChange || lineChange) {
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            this.setState({
                line_names: this.props.graph.lineNames(),
                line_ids: this.props.graph.lineIds(),
                line_colors: this.props.graph.lineColors(),
            })
            let svg = this.drawGraph();
            // log(svg);
            if(svg){
                d3.select(this._graphDiv.current)
                    .append("svg")
                    .attr("width", this.w)
                    .attr("height", this.h)
                    .node().appendChild(svg);
            }
            
            // this.drawGraph();
        }
        
    }

    createOnClickHandler(line: string, line_color: string) {
        return () => {
            this.props.graph.setDeleteLine(line, line_color);
            this.props.updateLegendState(true);
        };
    }
    /**
     * draws everything in the graph using d3
     * @param colorChange 
     * @param windowChanged 
     * @returns svg node component
     */
    drawGraph(newPanelWidth?: number, newPanelHeight?: number):any{
        const {graph,} = this.props;
        const line_names = graph.lineNames(), line_ids = graph.lineIds(), line_colors = graph.lineColors();
        const {margin, prev_lines, panelHeight, panelWidth} = this.state;
        const width = (newPanelWidth === undefined) ? panelWidth : newPanelWidth,
        height = (newPanelHeight === undefined) ? panelHeight : newPanelHeight;
        const legendW = width;
        // create svg component
        let svg = d3.select(this._graphDiv.current).append("svg").remove()
            .attr("width", width)
            .attr("height", height)
            .append("g");
            // .attr("transform", `translate(${margin.left},     ${margin.top})`);

        

        // SVG icon markup
        const svgIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512">
    <!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
    <path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"/>
  </svg>
`;

        //draw legend

        const legend_start_x = 0;
        const legend_start_y = 0;
        // svg
        //     .append("rect")
        //     .attr("x", legend_start_x)
        //     .attr("y", legend_start_y)
        //     .attr("width", legendW)
        //     .attr("height", 50 * (line_names.length + 1) + 35)
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

        // // Create right-click context menu

        // const contextMenu = svg
        //     .append("g")
        //     .attr("class", "context-menu")
        //     .style("display", "none");

        // document.addEventListener("click", () => {
        //     // Hide the context menu
        //     contextMenu.style("display", "none");
        // });

        // const option_width = 80,  // the width and height of an right-click menu option
        //     option_height = 20;
        // const start_x = -70,  // the offset of the option
        //     start_y = -15;
        // const option1 = contextMenu
        //     .append("g") // Create a group element
        //     .attr("class", "option")
        //     .attr("transform", `translate(${start_x},${start_y})`)
        //     .style("cursor", "pointer")
        //     .on("click", () => {
        //         // Option 1 click handler
        //         console.log("Option 1 clicked");
        //     });

        // option1
        //     .append("rect")
        //     .attr("width", option_width)
        //     .attr("height", option_height)
        //     .attr("fill", "white");

        // option1
        //     .append("text")
        //     .attr("x", option_width / 2)
        //     .attr("y", option_height / 2)
        //     .attr("text-anchor", "middle")
        //     .attr("dominant-baseline", "central")
        //     .style("font-size", "12px")
        //     .style("fill", "black")
        //     .text("Select as line1");

        // const option2 = contextMenu
        //     .append("g") // Create a group element
        //     .attr("class", "option")
        //     .attr(
        //         "transform",
        //         `translate(${start_x},${start_y + option_height})`
        //     )
        //     .style("cursor", "pointer")
        //     .on("click", () => {
        //         // Option 2 click handler
        //         console.log("Option 2 clicked");
        //     });

        // option2
        //     .append("rect")
        //     .attr("width", option_width)
        //     .attr("height", option_height)
        //     .attr("fill", "white");

        // option2
        //     .append("text")
        //     .attr("x", option_width / 2)
        //     .attr("y", option_height / 2)
        //     .attr("text-anchor", "middle")
        //     .attr("dominant-baseline", "central")
        //     .style("font-size", "12px")
        //     .style("fill", "black")
        //     .text("Select as line2");

        const radius = 8; // radius of the circle
        const xSize = 8; // the size of the trash icon
        const gap = 5; // gap between lines
        legend_y += 18;
        for (let i = 0; i < line_names.length; i++) {

            svg
                .append("circle")
                // .attr("class", "x label")
                .attr("fill", line_colors[i])
                .attr("cx", legend_start_x + 15)
                .attr("cy", legend_y)
                .attr("r", radius);

            let line_name = line_names[i];

            if (!graph.isDiff() && !graph.isTimeWarp()) {
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
                    .on("click", this.createOnClickHandler(line_ids[i], line_colors[i]));
                // Add the SVG icon markup to the foreignObject element
                trashIcon.html(svgIcon);


            //   const line1 = svg
            //     .append("line")
            //     .attr("x1", legend_start_x + x_offset)
            //     .attr("y1", legend_y - xSize)
            //     .attr("x2", legend_start_x + x_offset + 2 * xSize)
            //     .attr("y2", legend_y + xSize)
            //     .attr("stroke", "red")
            //     .attr("stroke-width", 2)
            //     .style("cursor", "pointer")
            //     .on("click", this.createOnClickHandler(line_ids[i], line_colors[i]));

            //   const line2 = svg
            //     .append("line")
            //     .attr("x1", legend_start_x + x_offset)
            //     .attr("y1", legend_y + xSize)
            //     .attr("x2", legend_start_x + x_offset + 2 * xSize)
            //     .attr("y2", legend_y - xSize)
            //     .attr("stroke", "red")
            //     .attr("stroke-width", 2)
            //     .style("cursor", "pointer")
            //     .on("click", this.createOnClickHandler(line_ids[i], line_colors[i]));
            }


            const c_length = 7; // the length of a single character
            const line_width = 0.9 * legendW - 2 * xSize - 2 * radius;
            const line_counts = Math.ceil(line_name.length * c_length / line_width);
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
            ((line: string) => {
                const div = foreignObject
                    .append("xhtml:div")
                    .style("font-weight", 600)
                    .style("font-size", "13px")
                    .style("max-width", "100%")
                    .style("color", line_colors[i]) // Set the text color
                    .html(
                        `<p style="word-wrap: break-word; margin: 0;">${line_name}</p>`
                    );

                // div.on("contextmenu", (event: MouseEvent) => {
                //     // Prevent default right-click event
                //     event.preventDefault();

                //     const svgElement = svg.node();
                //     const svgRect = svgElement.getBoundingClientRect();

                //     // Get the adjusted mouse coordinates relative to the SVG element
                //     const mouseX = event.pageX - svgRect.left;
                //     const mouseY = event.pageY - svgRect.top;

                //     //   console.log(
                //     //     "should be x: " +
                //     //       (legend_start_x + 25) +
                //     //       " y: " +
                //     //       legend_y
                //     //   );
                //     //   console.log("x: " + mouseX + " y: " + mouseY);

                //     // Position the context menu at the mouse coordinates
                //     contextMenu.attr(
                //         "transform",
                //         `translate(${mouseX}, ${mouseY})`
                //     );

                //     // Show the context menu
                //     contextMenu.style("display", "block");
                //     option1.on("click", () => {
                //         // Option 1 click handler
                //         if (this.props.onSelectLine)
                //             this.props.onSelectLine(line, 0);
                //     });

                //     option2.on("click", () => {
                //         // Option 2 click handler
                //         if (this.props.onSelectLine)
                //             this.props.onSelectLine(line, 1);
                //     });

                //     // Move the context menu container to the end of the SVG element's children
                //     svg.node().appendChild(contextMenu.node());
                // });
            }
            )(line_ids[i]);


            legend_y += line_height + gap;
        }
        

        this.w = width;
        this.h = 50 * (line_names.length + 1) + 100;
        this.setState({
            // w: width,
            // h: 50 * (line_names.length + 1) + 100,
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
