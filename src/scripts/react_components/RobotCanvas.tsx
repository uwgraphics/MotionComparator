import { SceneView } from "../scene/SceneView";
import React, { Component } from "react";
import { RobotScene } from "../scene/RobotScene";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Robot } from '../objects3D/Robot';
import { FUNC_ROLE } from '../constants';
import { CameraViewpointCallback, RobotSceneManager } from '../RobotSceneManager';
import T from "../true_three";
import { RobotLink } from "../objects3D/RobotLink";
import { RobotJoint } from "../objects3D/RobotJoint";
import { isAxesHelper, isMesh } from "../gaurds";
import { ShaderMaterial, MeshStandardMaterial, BackSide, UniformsLib, UniformsUtils,
    Color, NormalBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor, AdditiveBlending,
    ReverseSubtractEquation,  } from 'three';

/**
 * Many objects have a "isCLASS_NAME" property to allow the programmer to
 * determine if they have an object of a given class because all other classes
 * will have `undefined` or `false` instead of `true` for this property. This
 * is an issue for the type system because of the `undefined` being expected, so
 * this method accounts for that by checking for `undefined` or `false`.
 */
function flagIsTrue(obj: { [key: string]: any }, flagName: string): boolean {
    return (flagName in obj) && (obj[flagName] === true);
}

/**
 * Returns True if the given object is a descendant of the given group and false
 * otherwise.
 */
//function descendantOf(obj:T.Object3D, group:T.Group):boolean {
//    let descendant = false;
//    group.traverse(object3D => {
//        if (obj === object3D) {
//            descendant = true;
//        }
//    });
//    return descendant;
//}

export interface robot_canvas_props {
    allowSelecting?: boolean,
    robotSceneManager: RobotSceneManager,
    robotScene: RobotScene, // The scene that the BuildPage should show
    setSceneOptionPanelActive?: () => void,
    setRobotOptionPanelActive?: () => void,
}

interface robot_canvas_state {
}

/**
 * Multiple pages require a canvas that allows the viewing of a RobotScene on a
 * canvas with orbit controls so I have abstracted that away into this class.
 */
export class RobotCanvas extends Component<robot_canvas_props, robot_canvas_state> {
    protected _orbitView?: SceneView;
    
    protected _orbitCamera: T.Camera;
    protected _perspecCamera: T.Camera;
    protected _orthoCamera: T.Camera;
    protected _controls: OrbitControls | undefined;
    protected _canvasRef: React.RefObject<HTMLCanvasElement>;
    protected _resize_observer?: ResizeObserver;

    protected _raycaster: T.Raycaster;

    protected _pointer: T.Mesh;

    protected _syncViewCallback?: CameraViewpointCallback;

    constructor(props:robot_canvas_props) {
        super(props);

        this._perspecCamera = new T.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 1000);
        this._perspecCamera.position.set(3, 3, 3);
        this._perspecCamera.lookAt(0, 0, 0);
        this._perspecCamera.up.set(0, 0, 1);

        this._orthoCamera = new T.OrthographicCamera(window.innerWidth / -500, window.innerWidth / 500, window.innerHeight / 500, window.innerHeight / -500, 0.001, 1000);
        this._orthoCamera.position.set(3, 3, 3);
        this._orthoCamera.lookAt(0, 0, 0);
        this._orthoCamera.up.set(0, 0, 1);

        this._orbitCamera = this._perspecCamera;
        this._controls = undefined;

        this._raycaster = new T.Raycaster();

        this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this);
        this.onCanvasMouseMove = this.onCanvasMouseMove.bind(this);
        this.onCanvasMouseOut  = this.onCanvasMouseOut.bind(this);

        this._pointer = new T.Mesh(
            new T.SphereGeometry(
                0.01,
                30,
                30
            ),
            new T.MeshBasicMaterial({
                transparent: true,
                opacity: 0.75,
                color: new T.Color(Math.random() * 0xffffff)
            })
        );

        this._canvasRef = React.createRef();
        this.initScene(this.props.robotScene);
    }

    canSelectRobot(): boolean {
        return (this.props.allowSelecting ?? false) && this.props.robotSceneManager.allowRobotSelection();
    }

    /**
     * Makes the pointer visible at the given position in the given scene.
     */
    addPointer(rScene:RobotScene, pos:T.Vector3) {
        if (this.props.allowSelecting) {
            const scene = rScene.scene();
            if (scene.children.indexOf(this._pointer) === -1) {
                scene.add(this._pointer);
            }
            this._pointer.position.copy(pos);
            rScene.render();
        }
    }

    /**
     * Removes the pointer if it is in the given scene.
     */
    removePointer(rScene:RobotScene) {
        const scene = rScene.scene();
        if (scene.children.indexOf(this._pointer) !== -1) {
            scene.remove(this._pointer);
            rScene.render();
        }
    }

    /**
     * Initializes the canvas to a standard set of presets if it has not been
     * initialized by anything before.
     */
    initScene(robotScene:RobotScene) {
        robotScene.runOnce(FUNC_ROLE.INIT, () => {
            robotScene.scene().background =  new T.Color(robotScene.backgroundColor());
            robotScene.scene().position.set(0, 0, 0);

            let lightColor = 0xffffff;
            const directionalLight = new T.DirectionalLight(lightColor, robotScene.directionalLightIntensity());
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.setScalar(1024);
            directionalLight.position.set(5, 5, 30);
            directionalLight.shadow.bias = -0.0005
            directionalLight.lookAt(0, 0, 0);
            robotScene.scene().add(directionalLight);
            robotScene.setDirectionalLight(directionalLight);

            const ambientLight = new T.AmbientLight(lightColor, robotScene.ambientLightIntensity());
            robotScene.scene().add(ambientLight);
            robotScene.setAmbientLight(ambientLight);

            // const ground = new T.Mesh(new T.PlaneBufferGeometry(), new T.ShadowMaterial({ opacity: 0.25 }));
            const ground = new T.Mesh(new T.PlaneBufferGeometry(), new T.MeshStandardMaterial({ 
                color: new T.Color(robotScene.groundPlaneColor()),
                opacity: 0.2,
                transparent : true,
                depthWrite : true,
            }));
            ground.scale.setScalar(20);
            ground.position.z = -0.002;
            ground.receiveShadow = true;
            ground.visible = robotScene.isGroundPlaneVisible();
            robotScene.scene().add(ground);

            const grid = new T.GridHelper(20, 20, 0xffffff, 0x333333);
            grid.rotation.x = Math.PI / 2;
            grid.position.z = -0.001;
            grid.visible = robotScene.isGroundPlaneVisible();
            robotScene.scene().add(grid);
            robotScene.setGroundPlane(ground, grid);
        });
    }

    onCanvasMouseOut() {
        if (this.props.robotSceneManager.allowRobotSelection()) {
            this.removePointer(this.props.robotScene);
        }
    }

    /**
     * Called when mouse moves over the Canvas element.
     */
    onCanvasMouseMove(event:MouseEvent) {
        const ref = this._canvasRef.current;
        if (ref) {

            // Move the mouse and then see what robots are hovered.
            const mouse = new T.Vector2();

            let target = event.target;
            if (target) {
                let c = target as HTMLCanvasElement;

                // The coordinates of the mouse on the canvas
                let mouse_x = event.clientX - (event.clientX - event.offsetX);
                let mouse_y = event.clientY - (event.clientY - event.offsetY);

                mouse.x = ( ((mouse_x / c.clientWidth)  * 2.0)) - 1.0;
                mouse.y = (-((mouse_y / c.clientHeight) * 2.0)) + 1.0;
            }

            // Check if there is a Robot now being hovered over and set it is the
            // hovered robot of the RobotScene if so.
            const robots = this.props.robotScene.robots();
            const robotMeshes:(T.Mesh | T.AxesHelper | T.LineSegments)[] = [];
            const robotMeshMap:Map<T.Mesh | T.AxesHelper | T.LineSegments, Robot> = new Map();

            // Get all visible robot meshes so that we can test to see if any of
            // them intersect the line (and, if so, which one intersects it the
            // closest).
            for (const robot of robots) {
                if (robot.visible()) {
                    for (const mesh of robot.meshes()) {
                        if (mesh.visible) {
                            robotMeshMap.set(mesh, robot);
                            robotMeshes.push(mesh);
                        }
                    }
                }
            }

            this._raycaster.setFromCamera(mouse, this._orbitCamera);
            let intersects = this._raycaster.intersectObjects(robotMeshes);

            if (intersects.length > 0) {

                // Intersection objects are sorted by distance so index 0 is the
                // mesh closest to the camera. Take the Mesh from the
                // intersection object and lookup the mesh's parent Robot
                // using the mesh Map.
                let intersection = intersects[0];
                let robot = robotMeshMap.get(intersection.object as T.Mesh);

                if (robot) {
                    if (this.canSelectRobot()) {
                        this.props.robotScene.setHoveredRobot(robot);
                    }
                } else {
                    console.error("Intersected object was not a robot!");
                    this.props.robotScene.setHoveredRobot(undefined);
                }

                this.addPointer(this.props.robotScene, intersection.point)
            } else {
                this.props.robotScene.setHoveredRobot(undefined);
                this.removePointer(this.props.robotScene);
            }
        }
    }

    /**
     * When the canvas is clicked.
     */
    onCanvasMouseDown(/*event:MouseEvent*/) {
        // console.log(`Clicked on GraphPanel. the key is ` + this.props.graphKey);
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._canvasRef.current?.classList.add('selected');

        // Select whatever the currently hovered robot is (or no robot)
        if (this.canSelectRobot()) {
            // First, deselect all other robots
            let robotSceneManager = this.props.robotSceneManager;
            let robotScene = this.props.robotScene;

            // Deselects all other robots
            for (const _robotScene of robotSceneManager.allManagedRobotScenes()) {
                _robotScene.setSelectedRobot(undefined);
            }

            robotScene.setSelectedRobot(robotScene.hoveredRobot());
            robotSceneManager.setCurrRobotScene(robotScene);

            if(robotScene.hoveredRobot() === undefined)
            {
                if(this.props.setSceneOptionPanelActive !== undefined)
                    this.props.setSceneOptionPanelActive();
            }
            else
            {
                if(this.props.setRobotOptionPanelActive !== undefined)
                    this.props.setRobotOptionPanelActive();
            }
            for (const _robotScene of robotSceneManager.allManagedRobotScenes()) {
                if (_robotScene !== robotScene) {
                    _robotScene.setHoveredRobot(undefined);
                }
            }
        }
    }

    updateOrbitControls(robotScene:RobotScene, canvas?:HTMLCanvasElement) {
        // The orbit controls allow you to move the camera around a specific
        // point. When the camera is moved, an update function is called by
        // the OrbitControls object itself for its own internal book-keeping
        // but the update does not automatically make the scene re-render.
        //
        // This adds a function call after the origional update function to
        // make sure that the scene is re-rendered from the new camera
        // position.

        if (this._controls === undefined) {
            this._controls = new OrbitControls(this._orbitCamera, canvas);
        }
        else {
            this._controls.dispose();
            this._controls = new OrbitControls(this._orbitCamera, canvas);
        }
        let origUpdate = this._controls.update.bind(this._controls); // bind `this` because we will put the origional function in a function with a different value assigned to `this`
        this._controls.update = (() => {
            let result = origUpdate(); // run the origional update function
            this.props.robotSceneManager.setCurrSyncViewpoint([
                    this._orbitCamera.getWorldPosition(new T.Vector3()),
                    new T.Quaternion().setFromEuler(this._orbitCamera.rotation)
            ]);
            robotScene.render(); // Tell RobotScene that it needs to rerender because the camera's position changed
            return result;
        });
        this._controls.target.y = 0;
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.5;
        this._controls.rotateSpeed = 0.5;
        this._controls.update();
    }

    /**
     * Mount the RobotCanvas so that it is hooked up to the given scene and
     * canvas, thus allowing the scene to draw to the canvas.
     */
    mount(robotScene:RobotScene, canvas?:HTMLCanvasElement | null) {
        if (canvas) {
            this.initScene(robotScene);

            this.updateOrbitControls(robotScene, canvas);

            // Syncing Camera Veiwpoints
            if (this._syncViewCallback) {
                this.props.robotSceneManager.removeSyncViewCallback(this._syncViewCallback);
                this._syncViewCallback = undefined;
            }
            this._syncViewCallback = ((cv) => {
                let [newPos, newRot] = cv;
                this._orbitCamera.position.copy(newPos);
                this._orbitCamera.rotation.setFromQuaternion(newRot);
                this.props.robotScene.render();
            });
            this.props.robotSceneManager.addSyncViewCallback(this._syncViewCallback);

            // The SceneView is re-rendered automatically by the RobotScene
            // every time the RobotScene is changed.
            this._orbitView = new SceneView(canvas, this._orbitCamera,
                // callback called before the renderer writes to this canvas
                (canvas) => {

                // Before each render takes place, make sure that the dimensions
                // of the bitmap that the canvas uses are the same as the
                // dimensions of its client area

                let clientWidth = Math.floor(canvas.clientWidth);
                let clientHeight = Math.floor(canvas.clientHeight);

                if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
                    canvas.width = clientWidth;
                    canvas.height = clientHeight;
                }
            }, 
                // Callback after the renderer writes to this canvas
                // (canvas) => {
                //     // Outline the viwe in this scene's color
                //     let ctx = canvas.getContext("2d");
                //     if (ctx) {
                //         ctx.beginPath();
                //         ctx.strokeStyle = this.props.robotScene.color();
                //         ctx.lineWidth = 3;
                //         ctx.rect(0, 0, canvas.width, canvas.height);
                //         ctx.stroke();
                //     }
                // }
            );
            robotScene.addView(this._orbitView);
            robotScene.render(); // Make sure that the new SceneView is at least rendered to once

            canvas.addEventListener("mouseout", this.onCanvasMouseOut);
            canvas.addEventListener("mousemove", this.onCanvasMouseMove);
            canvas.addEventListener("click", this.onCanvasMouseDown);

            if (this._resize_observer) this._resize_observer.unobserve(canvas);
            this._resize_observer = new ResizeObserver(() => {

                // Rerender the robotScene onto the canvas
                this.props.robotScene.render();
            });
            this._resize_observer.observe(canvas);
        }
    }

    /**
     * Unmounts the given canvas from the given robotScene (because of either
     * changing scenes or deleting canvas)
     */
    unmount(robotScene:RobotScene, canvas?:HTMLCanvasElement | null) {
        // Remove camera syncing
        if (this._syncViewCallback) {
            this.props.robotSceneManager.removeSyncViewCallback(this._syncViewCallback);
            this._syncViewCallback = undefined;
        }

        // Remove the orbit controls
        if (this._controls) {
            this._controls.dispose();
            this._controls = undefined;
        }

        // Remove orbit view (so that it no longer is rendered to by the robot scene)
        if (this._orbitView) {
            robotScene.removeView(this._orbitView);
            this._orbitView = undefined;
        }

        // Remove the listeners from the camera
        if (canvas) {
            canvas.removeEventListener("mouseout", this.onCanvasMouseOut);
            canvas.removeEventListener("mousemove", this.onCanvasMouseMove);
            canvas.removeEventListener("click", this.onCanvasMouseDown);
            this._resize_observer?.unobserve(canvas);
        }

        this.removePointer(robotScene); // removes the pointer if it is in the given Scene
    }

    // ---------------
    // React Methods

    /**
     * This method is run by React every time the passed in props are
     * changed/updated.
     * @param prevProps The previous props before the update.
     */
    componentDidUpdate(prevProps:robot_canvas_props) {
        if (prevProps.robotScene !== this.props.robotScene) {
            // Need to remount/rebind (make this RobotCanvas show the renders of
            // the current RobotScene and no the old one) this RobotCanvas now
            // that the RobotScene has changed
            this.unmount(prevProps.robotScene, this._canvasRef.current);
            this.mount(this.props.robotScene, this._canvasRef.current);
        }
        if(this.props.robotScene.isToggleWorldFrame())
        {
            if(this.props.robotScene.worldFrame() === "ROS")
                this._orbitCamera.up.set(0, 0, 1);
            else
                this._orbitCamera.up.set(0, 1, 0);
            this.unmount(prevProps.robotScene, this._canvasRef.current);
            this.mount(this.props.robotScene, this._canvasRef.current);
            this.props.robotScene.finishToggleWorldFrame();
        }
        if(this.props.robotScene.isToggleCamera())
        {
            if(this.props.robotScene.cameraType() === "Orthographic")
                this._orbitCamera = this._orthoCamera;
            else
                this._orbitCamera = this._perspecCamera;
            this.unmount(prevProps.robotScene, this._canvasRef.current);
            this.mount(this.props.robotScene, this._canvasRef.current);
            this.props.robotScene.finishToggleCamera();
        }
    }

    componentDidMount() {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._canvasRef.current?.classList.add('selected');
        this.mount(this.props.robotScene, this._canvasRef.current);
    }

    componentWillUnmount() {
        this.unmount(this.props.robotScene, this._canvasRef.current);
    }

    decomposeId(eventName:string)
    {
        const content = eventName.split("&");
        const [name, partName] = content;
        const [sceneId, robotName] = name.split("#");
        return [sceneId, robotName, partName];
    }
    /**
     * enable the button to be dragged over the panel
     * @param event 
     */
    dragOverHandler(event: any) {
        event.preventDefault();
      }
    /**
     * handle the drop of a button
     * store the information of the button in currObjects
     * the info has a format like scene_id#robot_name&robotpart_name
     * @param event 
     * @returns 
     */
    dropHandler(event: any) {
        event.preventDefault();
        let eventName = event.dataTransfer.getData("text/plain");
        const [sceneId, robotName, partName] = this.decomposeId(eventName);
        let droppedScene = this.props.robotSceneManager.robotSceneById(sceneId); // the scene of the dropped button
        if(droppedScene === undefined) return;
        let robot = droppedScene.getRobotByName(robotName);
        if(robot === undefined) return;
        const currScene = this.props.robotScene;
        if(partName !== undefined)  // handle the drop of a robot part button (add traces)
        {
          let robotPart: RobotLink | RobotJoint | undefined = robot.jointMap().get(partName);
          if (robotPart === undefined) {
            robotPart = robot.linkMap().get(partName);
            // if (robotPart === undefined) return;
          }
          if (currScene === droppedScene) { // add a child trace
            if (currScene.hasChildTrace(robot, robotPart)) {
            //   currScene.removeChildTrace(robot, robotPart);
            } else {
              currScene.addChildTrace(
                robot,
                RobotScene.frameRange(
                  this.props.robotSceneManager.startTime(),
                  this.props.robotSceneManager.endTime()
                ),
                robotPart
              );
            }
          }
          else // add a ghost trace
          {
            if (currScene.hasReceivedGhostTrace(robot, robotPart))
            {
                //   droppedScene.removeGhostTracesFrom(robot, robotPart, currScene);
            }
            else {
              // Add a trace from the given robotscene and robot to the current scene
              droppedScene.sendGhostTracesTo(
                robot,
                RobotScene.frameRange(
                  this.props.robotSceneManager.startTime(),
                  this.props.robotSceneManager.endTime()
                ),
                robotPart,
                currScene
              );
            }
            
          }
        }
        else // handle the drop of a robot button (add ghosts)
        {
            if (robot.controlledCloneInScene(currScene)) {
                // Already in scene so remove it
                // robot.removeControlledClone(currScene);
            } else {
                // Not in scene so add it
                let controlledClone = robot.addControlledClone(currScene);
                controlledClone.setOpacity(0.5);
                currScene.render();
            }
        }
       
    }

    render() {
        // Note: The canvas is in a div only for the sake of consistency with
        // the other Component classes
        let out = (
          <div
            className="RobotCanvas"
            onDrop={this.dropHandler.bind(this)}
            onDragOver={this.dragOverHandler.bind(this)}
          >
            <canvas className="RobotCanvasCanvas" ref={this._canvasRef} />
          </div>
        );

        return out;
    }
}