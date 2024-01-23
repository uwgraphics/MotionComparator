import { Component, createRef } from "react";
import * as d3 from 'd3'; 
import { binarySearchIndexLargestSmallerEqual, binarySearchIndexSmallestGreaterEqual, findLargestSmallerElement, genSafeLogger } from "../helpers";
import _ from 'lodash';
import { umap_data_entry } from "./panels/UmapGraphPanel";


/**
 * UmapLineGraph is similar to LineGraph, except the x-axis does not represent the
 * time data
 */
interface line_graph_props {
    times: number[][],
    xVals: number[][],
    yVals: number[][],
    startTime: number,
    endTime: number,
    currTime: number,
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of ids of lines graphed
    // prev_map: Map<string, number>, //maps line ids to index in line_names -> only includes lines that needed to be drawn
    line_colors: string[], //list of colors of lines graphed
    isTimeWarp: boolean,
    selected?: boolean // whether the current tab is selected or not
    width: number, 
    height: number,
    lineWidth: number,
    axisColor: string,
    onGraphUpdate: (updated:boolean) => boolean,
    onCurrChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,
}


interface line_graph_state {
    // w: number,
    // h: number,
    prev_x: any,
    prev_y: any,
    margin: margin_obj,
    // prev_lines: Map<string, any>, //map line ids to line "object"
    // time_concat: number[],
    time_min: number,
    time_max: number,
    val_concat: number[],
    newCurr: number,
    
    mouseXCoord: number //only need x coordinate
    originalMouseXCoord: number
    currDragItem: dragItem;

}
type dragItem = "end"|"start"|"curr"|null;
interface margin_obj{
    top: number,
    right: number, 
    bottom: number, 
    left: number 
}
export class UmapLineGraph extends Component<line_graph_props, line_graph_state> {
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    constructor(props:line_graph_props){
        super(props);
        this._graphDiv = createRef();
        this.drawGraph.bind(this);
        const {width, height} = this.props;
        this.state = {
            // w: width,//+300,//1015,
            // h: height,//600,
            prev_x: null,
            prev_y: null,
            margin: {
                top: 0,
                right: 10, 
                bottom: 20, 
                left: 10, // should be careful with this value as it can mess up the value along y axis
            },
            // prev_lines: new Map<string, any>(),
            // time_concat: [],
            time_min: -999,
            time_max: -999,
            val_concat: [],
            newCurr: this.props.currTime,
            mouseXCoord: -1,
            originalMouseXCoord: -1,
            currDragItem: null
        };
    }
    componentDidMount(): void {
        if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
            this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
        }
        // const {w, h} = this.state;
        const {height, width} = this.props;
        let svg = this.drawGraph(true, true);
        if(svg){
            d3.select(this._graphDiv.current)
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .node().appendChild(svg);
        }
        
    }
    componentDidUpdate(prevProps:line_graph_props) {
        const boundChangeInZoom =(prevProps.startTime !== this.props.startTime || prevProps.endTime !== this.props.endTime);
        let colorChange = !_.isEqual(new Set(prevProps.line_colors), new Set(this.props.line_colors)) && prevProps.line_colors.length === this.props.line_colors.length;
        let windowChanged = prevProps.height !== this.props.height || prevProps.width !== this.props.width;
        const currTimeChange = prevProps.currTime !== this.props.currTime;
        const lineWidthChange = prevProps.lineWidth !== this.props.lineWidth;
        const axisColorChange = prevProps.axisColor !== this.props.axisColor;
        if (prevProps.times !== this.props.times || prevProps.xVals !== this.props.xVals ||
            windowChanged ||colorChange || lineWidthChange || axisColorChange ||
            boundChangeInZoom || currTimeChange) {
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            // const {w, h} = this.state;
            const {width, height} = this.props;
            let svg = this.drawGraph(boundChangeInZoom, colorChange, windowChanged);
            // log(svg);
            // console.log("width " + w + " height " + h);
            if(svg){
                d3.select(this._graphDiv.current)
                    .append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .node().appendChild(svg);
            }
            
            // this.drawGraph();
        }
        
    }

    /**
     * filter the data based on the current start time and end time
     * @param startTime 
     * @param endTime 
     * @returns 
     */
    filterData(startTime: number, endTime: number): [number[][], number[][], number[][]]
    {
        let zoomedTimes: number[][] = [], zoomedXValues: number[][] = [], zoomedYValues: number[][] = [];
        const {times, xVals, yVals} = this.props;
        if(times.length === 0){
            return [[[0]], [[0]], [[0]]];
        }
        
        for (let i = 0; i < times.length; i++) {
            let index = 0;
            zoomedTimes[i] = [];
            zoomedXValues[i] = [];
            zoomedYValues[i] = [];
            let startIndex = binarySearchIndexSmallestGreaterEqual(times[i], startTime);
            let endIndex = binarySearchIndexLargestSmallerEqual(times[i], endTime);
            if(startIndex === undefined) startIndex = 0;
            if(endIndex === undefined) endIndex = times[i].length - 1;
            for (let j = startIndex; j < endIndex; j++) {
                
                zoomedTimes[i][index] = times[i][j];
                zoomedXValues[i][index] = xVals[i][j];
                zoomedYValues[i][index] = yVals[i][j];
                index++;
            }
        }
        // console.log(vals);
        return [zoomedTimes, zoomedXValues, zoomedYValues]
    }
    /**
     * 
     * @param a times array
     * @param b values array
     * @returns list of data entry to plug into d3 graph
     */
    parseData(x:number[], y: number[]):umap_data_entry[]{
        let result = [];
        for(let i = 0; i < x.length; i++){
            result.push({x: x[i], y: y[i]})
        }
        return result;

    }
    /**
     * flatten 2d array to 1d array
     * @param data 2d array
     * @returns 1d array
     */
    concatData(data:number[][]):number[]{
        let result:number[] = [];
        for(let i = 0; i < data.length; i++){
            result = result.concat(data[i]);
        }
        return result;
    }
    /**
     * cauculate the offset given start, end, and current
     * @param width 
     * @param start 
     * @param end 
     * @param curr 
     * @returns 
     */
    calculateOffset(width: number, start: number, end: number, curr: number):number{
        if(end === start) return 0;
        const length = end - start;
        return (curr-start)/length * width;
    }

    getCurrTimeIndex(times: number[], currTime: number): number
    {
        return findLargestSmallerElement(times, currTime);
    }

    getCurrCoordinate(currTimeIndex: number, x: number[], y: number[], currTime: number, times: number[])
    {
        let prevIndex = currTimeIndex, nextIndex = currTimeIndex + 1;
        if(nextIndex >= x.length) return [x[x.length-1], y[x.length-1]];
        if(prevIndex === -1)
            return [x[0], y[0]];
        let interpolate: (prev: number, next: number, ratio: number) => number = (prev, next, ratio) => {
            return prev * (1-ratio) + next * ratio;
        }

        let ratio = (currTime - times[prevIndex]) / (times[nextIndex] - times[prevIndex]);
        return [interpolate(x[prevIndex], x[nextIndex], ratio), interpolate(y[prevIndex], y[nextIndex], ratio)]
    }

    /**
     * Compute time given x position and other time data
     * @param width width of axis
     * @param start start time
     * @param end end time
     * @param xPos position to compute time for
     * @returns 
     */
    static TimeFromXPosition(width: number, start: number, end: number, xPos: number):number{
        const length = end - start;
        let result = (xPos)/width * length;
        if (result > end){
            result = end;
        }else if(result < start){
            result = start
        }
        return result;

    }
    // /**
    //  * check if any update is needed based on prev_map
    //  * @returns boolean
    //  */
    // prevMapChanged(){
    //     const {prev_map} = this.props;
    //     const {prev_lines} = this.state;
    //     if(prev_map.size === 0){
    //         // log("prev map empty");
    //         return true;
    //     }
    //     for(const [id, ] of prev_map){
    //         //this would never be -1 because fillgraphdata changed that
    //         // if(ind === -1){
    //         //     log("prev map changed");
    //         //     return true;
    //         // }
    //         if(!(id in prev_lines)){
    //             // log("prev map changed");
    //             return true;
    //         }
    //     }
    //     // log("prev map unchanged");
    //     return false;
    // }

    // /**
    //  * handle dragging current time(red vertical line)
    //  * @param event 
    //  * @returns 
    //  */
    // dragCurr(event: any){
    //     const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
    //     let width = this.props.width-margin.right -margin.left;
    //     // log("in dragCurr, mouseX = "+event.x)
    //     let xPos = event.x;
    //     if(xPos > width && this.state.mouseXCoord < 0){
    //         // log("recorded event.x: "+ xPos);
    //         this.setState({
    //             mouseXCoord: xPos,
    //             currDragItem: "curr"
    //         })
    //         return;
    //     }
    //     if(xPos > width){
    //         if(currDragItem !== "curr"){
    //             return;
    //         }
    //         xPos = xPos - mouseXCoord + originalMouseXCoord;
    //     }
    //     // while(xPos > width && event.x !== event.subject.x){
    //     //     // log("decrementing");
    //     //     // log(event);
    //     //     xPos -= width;
    //     // }
    //     //let xPos = event.x-width;//this cause rectangle to disappeare for a little but no cycling effect
    //     //let xPos = (event.x>width)? event.x-width: event.x; //this creates cycle effect
        
    //     let newCurr = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
    //     // log("in dragCurr")
    //     // log(newCurr);
    //     if(newCurr < time_min){
    //         newCurr = time_min;
    //     }else if(newCurr > time_max){
    //         newCurr = time_max;
    //     }
    //     this.props.onCurrChange(newCurr);
    //     // this.s?
  
    // }
    // /**
    //  * handle dragging start of yellow rectangle
    //  * @param event 
    //  * @returns 
    //  */
    // dragStart(event: any){
    //     const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
    //     let width = this.props.width-margin.right-margin.left;
    //     // log("in dragStart, mouseX = "+event.x)

    //     // let xPos = (event.x === event.subject.x)?event.x:event.x-width;
    //     let xPos = event.x;
    //     if(event.x < 0){
    //         xPos = 0;
    //     }
    //     if(xPos > width && this.state.mouseXCoord < 0){
    //         // log("recorded event.x: "+ xPos);
    //         this.setState({
    //             mouseXCoord: xPos,
    //             currDragItem: "start"
    //         })
    //         return;
    //     }
    //     if(xPos > width){
    //         if(currDragItem !== "start"){
    //             return;
    //         }
    //             xPos = xPos - mouseXCoord + originalMouseXCoord;

    //         // }
    //     }
    //     let newStart = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
    //     if(newStart > time_max){
    //         newStart = time_max;
    //     }else if(newStart < time_min){
    //         newStart = time_min;
    //     }
    //     this.props.onStartChange(newStart);
    // }
    // /**
    //  * handle dragging end of yellow triangle
    //  * @param event 
    //  * @returns 
    //  */
    // dragEnd(event: any){
    //     const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
    //     let width = this.props.width-margin.right-margin.left;
    //     // let xPos = (event.x === event.subject.x)?event.x:event.x-width; 
    //     let xPos = event.x;
    //     if(xPos > width && this.state.mouseXCoord < 0){
    //         // log("recorded event.x: "+ xPos);
    //         this.setState({
    //             mouseXCoord: xPos,
    //             currDragItem: "end"
    //         })
    //         return;
    //     }
    //     if(xPos > width){
    //         if(currDragItem !== "end"){
    //             return;
    //         }
    //         xPos = xPos - mouseXCoord + originalMouseXCoord;
    //     }
    //     // log("drag End x position is "+xPos );
    //     // log(event);
    //     let newEnd = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
    //     if(newEnd > time_max){
    //         newEnd = time_max;
    //     }else if(newEnd < time_min){
    //         newEnd = time_min;
    //     }
    //     // log("in dragEnd");
    //     // log(newEnd);
    //     this.props.onEndChange(newEnd);

    // }
    /**
     * record current mouse position
     * @param event 
     */
    currMouse(event:any){
        this.setState({
            originalMouseXCoord: event.x
        })
    }
    /**
     * record end mouse position
     * @param event 
     */
    endMouse(event:any){
        this.setState({
            mouseXCoord: -1,
            originalMouseXCoord: -1
        })
    }

    /**
     * calculate the Euclean distance between two points in 2d space
     * @param p1 
     * @param p2 
     * @returns 
     */
    calculateDistance(p1: umap_data_entry, p2: umap_data_entry): number
    {
        return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
    }
    /**
     * do not connect two points if their distance is greater than 1
     * @param data 
     */
    filterDataByDistance(data: umap_data_entry[]): umap_data_entry[][]
    {
        let result: umap_data_entry[][] = [];
        if(data.length == 0) return result;
        let curr: umap_data_entry[] = [];
        curr.push(data[0]);
        for(let i=1; i<data.length; i++)
        {
            if(this.calculateDistance(data[i], data[i-1]) <= 2)
                curr.push(data[i]);
            else{
                result.push(curr);
                curr = [];
                curr.push(data[i]);
            }
        }
        if(curr.length > 0 ) result.push(curr);
        return result;
    }

    /**
     * draws everything in the graph using d3
     * @param boundChangeInZoom 
     * @param colorChange 
     * @param windowChanged 
     * @returns svg node component
     */
    drawGraph(boundChangeInZoom?:boolean, colorChange?:boolean, windowChanged?:boolean):any{
        // return 1;
        const {times, xVals, yVals, 
            startTime, endTime, currTime, 
            isTimeWarp, lineWidth, axisColor,
            line_names, line_colors, line_ids,
            onGraphUpdate} = this.props;
        const w = this.props.width;
        const h = this.props.height;
        const isDataChanged = true;
        
        const {margin, prev_x, prev_y} = this.state;
        //width = w - margin.left - margin.right,
        const width = w - margin.left - margin.right,
        height = h - margin.top - margin.bottom;
        
        // create svg component
        let svg = d3.select(this._graphDiv.current).append("svg").remove()
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},     ${margin.top})`);

        const min = 0, max = 8; // default min and max of x and y axis
        // if(!times.length || !xVals.length){
        //     // draw an empty graph
        //     // log("Warning: Empty times and vals for LineGraph")

        //     // const timeBarStart = LineGraph.xPositionFromTime(width, min, max, startTime);
        //     // const timeBarCurr = LineGraph.xPositionFromTime(width, min, max, currTime);
        //     // const timeBarEnd = LineGraph.xPositionFromTime(width, min, max, endTime);
        //     // console.log(startTime + " " + endTime + " " + width);
        //     // console.log(this.props.width);
        //     // svg.append("rect")
        //     //     .attr("x", timeBarCurr -1)
        //     //     .attr("y", 0)
        //     //     .attr("width", 2)
        //     //     .attr("height", height)
        //     //     .attr("fill", "#b00")
        //     //     .attr("fill-opacity","75%");

        //     x_axis = d3.scaleLinear().range([0, width]);
        //     y_axis = d3.scaleLinear().range([height, 0]);
        //     x_axis.domain(d3.extent([startTime, endTime]));
        //     y_axis.domain(d3.extent([min, max]));
        //     let xAxis = svg.append("g")
        //         .attr("transform", `translate(0, ${height})`)
        //         .call(d3.axisBottom(x_axis).tickSize(0));
        //     let yAxis = svg.append("g")
        //         .call(d3.axisLeft(y_axis).tickSize(0));

        //     xAxis.selectAll("line, path")
        //         .style("stroke", axisColor);
        //     yAxis.selectAll("line, path")
        //         .style("stroke", axisColor);
        //     xAxis.selectAll("text")
        //         .style("fill", axisColor);
        //     yAxis.selectAll("text")
        //         .style("fill", axisColor);
            
        //     onGraphUpdate(true);
        //     return svg.node();
        // }

        let [zoomedTimes, zoomedXValues, zoomedYValues] = this.filterData(startTime, endTime);

        let data:umap_data_entry[][] = [this.parseData(zoomedXValues[0], zoomedYValues[0])];
        for(let i = 1; i < zoomedXValues.length; i++){
            data.push(this.parseData(zoomedXValues[i], zoomedYValues[i]));
            console.log(i + " " + data[i].length);
        }  
        // let dragC = d3.drag()
        //     .on('start', (event:any)=>{this.currMouse(event)})
        //     .on('drag', (event:any)=>{this.dragCurr(event)})
        //     .on('end', (event:any)=>{this.endMouse(event)});
            
        // let dragS = d3.drag()
        //     .on('start', (event:any)=>{this.currMouse(event)})
        //     .on('drag', (event:any)=>{this.dragStart(event)})
        //     .on('end', (event:any)=>{this.endMouse(event)});
        // let dragE = d3.drag()
        //     .on('start', (event:any)=>{this.currMouse(event)})
        //     .on('drag', (event:any)=>{this.dragEnd(event)})
        //     .on('end', (event:any)=>{this.endMouse(event)}); 
        let xConcat = this.concatData(zoomedXValues);
        let yConcat = this.concatData(zoomedYValues);
        for(let i=0; i<xVals.length; i++)
        {
            let timeIndex = this.getCurrTimeIndex(times[i], currTime);
            const [currX, currY] = this.getCurrCoordinate(timeIndex, xVals[i], yVals[i], currTime, times[i]);
            const currXPos = this.calculateOffset(width, d3.min(xConcat), d3.max(xConcat), currX);
            const currYPos = this.calculateOffset(height, d3.min(yConcat), d3.max(yConcat), currY);
            const radius = 4;
            // console.log(currX + " " + currY + " " + currXPos + " " + currYPos);
            svg.append("circle")
                .attr("cx", currXPos)
                .attr("cy", height - currYPos)
                .attr("r", radius)
                .attr("fill", "#b00")
                .attr("fill-opacity","75%");
        }
        
        // const timeBarStart = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), startTime);
        
        // const timeBarEnd = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), endTime);
        // console.log(timeBarStart + " " + (timeBarCurr - 2) + " " + (timeBarEnd - timeBarStart));
        

            // svg.append("rect")
            //     .attr("x", timeBarCurr -1)
            //     .attr("y", 0)
            //     .attr("width", 2)
            //     .attr("height", height)
            //     .attr("fill", "#b00")
            //     .attr("fill-opacity","75%");

        
        // Add X axis and Y axis
        var x_axis: { (arg0: number): number; (arg0: number): number; domain: any; }; //type is generated by Typescript
        var y_axis: { (arg0: number): number; (arg0: number): number; domain: any; };
        if(onGraphUpdate(false) || isDataChanged || boundChangeInZoom || windowChanged || !prev_x || !prev_y){
            x_axis = d3.scaleLinear().range([0, width]).domain(d3.extent(xConcat));
            y_axis = d3.scaleLinear().range([height, 0]).domain(d3.extent(yConcat));
        }else{
            x_axis = prev_x;
            y_axis = prev_y;
        }
        
        let bottonAxis = d3.axisBottom(x_axis).tickSize(0).tickValues([]);
        let leftAxis = d3.axisLeft(y_axis).tickSize(0).tickValues([]);
        let topAxis = d3.axisTop(x_axis).tickSize(0).tickValues([]);
        let rightAxis = d3.axisRight(y_axis).tickSize(0).tickValues([]);

        let bottomAxisGroup = svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .classed('GraphAxis', true)
            .call(bottonAxis);
        
        let leftAxisGroup = svg.append("g")
            .classed('GraphAxis', true)
            .call(leftAxis);

        let topAxisGroup = svg.append("g")
            .classed('GraphAxis', true)
            .call(topAxis);

        let rightAxisGroup = svg.append("g")
            .attr("transform", `translate(${width}, 0)`)
            .classed('GraphAxis', true)
            .call(rightAxis);

        bottomAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
        leftAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
        topAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
        rightAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
      
        // add the Line
        let id;
        let valueLine = d3.line()
                    .x((d:umap_data_entry):number => { return x_axis(d.x); })
                    .y((d:umap_data_entry):number => { return y_axis(d.y); });
        if(isTimeWarp){
            let path1 = svg.append("path").remove()
                    .append("path")
                    .data([data[1]])
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke", line_colors[1])
                    .attr("stroke-width", lineWidth)
                    .attr("d", valueLine)
                    .node()
            
            svg.node().appendChild(path1);
            let path2 = svg.append("path").remove()
                    .append("path")
                    .data([data[0]])
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke", line_colors[0])
                    .attr("stroke-width", lineWidth)
                    .attr("d", valueLine)
                    .node()

            svg.node().appendChild(path2);
        }else{
            // for UMAP, we need to redraw the graph every time when the line changes
            for(let i = 0; i < data.length; i++){
                id = line_ids[i];
                // if(prev_lines.has(id) && !boundChangeInZoom && !colorChange && !windowChanged && !onGraphUpdate(false)){ //not new select and have previous line
                //     svg.node().appendChild(prev_lines.get(id));            
                // }else{
                for (const d of this.filterDataByDistance(data[i])) {
                    let path = svg.append("path").remove()
                        .append("path")
                        .data([d])
                        .attr("class", "line")
                        .attr("fill", "none")
                        .attr("stroke", line_colors[i])
                        .attr("stroke-width", lineWidth)
                        .attr("d", valueLine)
                        .node()
                    svg.node().appendChild(path);
                }
                
                //     prev_lines.set(id, path);
                // }
            }
        }
        
        // //add draggable components(just rectangles)
        // svg.append("rect")
        //         .attr("x", timeBarCurr -20)
        //         .attr("y", 0)
        //         .attr("width", 40)
        //         .attr("height", height)
        //         .attr("fill", "#b00")
        //         .attr("fill-opacity","0%")
        //         .call(dragC);
            
        //     svg.append("rect")
        //         .attr("x", timeBarStart)
        //         .attr("y", 0)
        //         .attr("width", 30)
        //         .attr("height", height)
        //         .attr("fill", "#ff0")
        //         .attr("fill-opacity","0%")
        //         .call(dragS);

        //     svg.append("rect")
        //         .attr("x", timeBarEnd-30)
        //         .attr("y", 0)
        //         .attr("width", 30) 
        //         .attr("height", height)
        //         .attr("fill", "#ff0")
        //         .attr("fill-opacity","0%")
        //         .call(dragE);

        
        this.setState({
            // w: width + margin.left + margin.right,
            // h: height + margin.top + margin.bottom,
            // prev_lines: prev_lines,
            prev_x: x_axis,
            prev_y: y_axis,
            // newCurr: newCurr

            // time_min: d3.min(timeConcat), 
            // time_max: d3.max(timeConcat),
        });
        // this._graphDiv.current!.appendChild(svg.node());
        // let temp = d3.select(this._graphDiv.current).append("svg")
        //     .attr("width", width + margin.left + margin.right)
        //     .attr("height", height + margin.top + margin.bottom)
        //     .append(svg)
        // this._graphDiv.current!.appendChild(temp);
        // log(svg.node());
        onGraphUpdate(true);
        return svg.node();
        

    }
    render() {
        //const {w, h} = this.state;
        const {isTimeWarp, times, selected, axisColor} = this.props;
        let styles = {display: "inline-block", marginBottom: "10px", color: axisColor};
        // if(selected !== undefined && selected)
        //     styles = {display: "inline-block", marginBottom: "10px", color:"yellow"}
        // else
        //     styles = {display: "inline-block", marginBottom: "10px"}
        return (
            <div>
                <div style={{textAlign: "center"}}>
                </div>
                <div className="UmapGraph" ref={this._graphDiv}>
                </div>
            </div>
        );
    }
}
