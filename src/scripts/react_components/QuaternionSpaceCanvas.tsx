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
import { QuaternionSpaceScene } from "../scene/QuaternionSpaceScene";

export interface quaternion_canvas_props {
    allowSelecting?: boolean,
    robotSceneManager: RobotSceneManager,
    quaternionSpaceScene: QuaternionSpaceScene, // The scene that the BuildPage should show
    setQuaternionSceneOptionPanelActive: () => void,
}

interface quaternion_canvas_state {
}


export class QuaternionSpaceCanvas extends Component<quaternion_canvas_props, quaternion_canvas_state> {
    protected _orbitView?: SceneView;
    
    protected _orbitCamera: T.Camera;
    protected _canvasRef: React.RefObject<HTMLCanvasElement>;
    protected _resize_observer?: ResizeObserver;

    protected _raycaster: T.Raycaster;

    protected _pointer: T.Mesh;

    //protected _syncViewCallback?: CameraViewpointCallback;

    constructor(props:quaternion_canvas_props) {
        super(props);

        this._orbitCamera = new T.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 1000);
        this._orbitCamera.position.set(2, 2, 2);
        this._orbitCamera.lookAt(0, 0, 0);
        this._orbitCamera.up.set(0, 0, 1);

        this._raycaster = new T.Raycaster();

        this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this);

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
        this.initScene(this.props.quaternionSpaceScene);
    }

    canSelectRobot(): boolean {
        return (this.props.allowSelecting ?? false) && this.props.robotSceneManager.allowRobotSelection();
    }

    /**
     * Makes the pointer visible at the given position in the given scene.
     */
    addPointer(rScene:QuaternionSpaceScene, pos:T.Vector3) {
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
    removePointer(rScene:QuaternionSpaceScene) {
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
    initScene(quaternionSpaceScene:QuaternionSpaceScene) {
        quaternionSpaceScene.runOnce(FUNC_ROLE.INIT, () => {
            quaternionSpaceScene.scene().background =  new T.Color(quaternionSpaceScene.backgroundColor());
            quaternionSpaceScene.scene().position.set(0, 0, 0);

            let lightColor = 0xffffff;
            const directionalLight = new T.DirectionalLight(lightColor, 1.0);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.setScalar(1024);
            directionalLight.position.set(5, 5, 30);
            directionalLight.shadow.bias = -0.0005
            directionalLight.lookAt(0, 0, 0);
            quaternionSpaceScene.scene().add(directionalLight);

            const ambientLight = new T.AmbientLight(lightColor, 0.2);
            quaternionSpaceScene.scene().add(ambientLight);

            const ground = new T.Mesh(new T.PlaneBufferGeometry(), new T.ShadowMaterial({ opacity: 0.25 }));
            // ground.position.y = 0; 
            // ground.rotation.x = - Math.PI / 2; 
            
            ground.scale.setScalar(30);
            ground.receiveShadow = true;
            quaternionSpaceScene.scene().add(ground);
        });
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
        this.props.robotSceneManager.setCurrQuaternionSpaceScene(this.props.quaternionSpaceScene.id().value());
        this.props.setQuaternionSceneOptionPanelActive();
    }

    /**
     * Mount the RobotCanvas so that it is hooked up to the given scene and
     * canvas, thus allowing the scene to draw to the canvas.
     */
    mount(quaternionSpaceScene:QuaternionSpaceScene, canvas?:HTMLCanvasElement | null) {
        if (canvas) {
            this.initScene(quaternionSpaceScene);

            // The orbit controls allow you to move the camera around a specific
            // point. When the camera is moved, an update function is called by
            // the OrbitControls object itself for its own internal book-keeping
            // but the update does not automatically make the scene re-render.
            //
            // This adds a function call after the origional update function to
            // make sure that the scene is re-rendered from the new camera
            // position.
            const controls = new OrbitControls(this._orbitCamera, canvas);
            let origUpdate = controls.update.bind(controls); // bind `this` because we will put the origional function in a function with a different value assigned to `this`
            controls.update = (() => {
                let result = origUpdate(); // run the origional update function
                // this.props.robotSceneManager.setCurrSyncViewpoint([
                //         this._orbitCamera.getWorldPosition(new T.Vector3()),
                //         new T.Quaternion().setFromEuler(this._orbitCamera.rotation)
                // ]);
                quaternionSpaceScene.render(); // Tell RobotScene that it needs to rerender because the camera's position changed
                return result;
            });
            controls.target.y = 0;
            controls.enableDamping = true;
            controls.dampingFactor = 0.5;
            controls.rotateSpeed = 0.5;
            controls.update();

            // Syncing Camera Veiwpoints
            // if (this._syncViewCallback) {
            //     this.props.robotSceneManager.removeSyncViewCallback(this._syncViewCallback);
            //     this._syncViewCallback = undefined;
            // }
            // this._syncViewCallback = ((cv) => {
            //     let [newPos, newRot] = cv;
            //     this._orbitCamera.position.copy(newPos);
            //     this._orbitCamera.rotation.setFromQuaternion(newRot);
            //     this.props.quaternionSpaceScene.render();
            // });
            // this.props.robotSceneManager.addSyncViewCallback(this._syncViewCallback);

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
            );
            quaternionSpaceScene.addView(this._orbitView);
            quaternionSpaceScene.render(); // Make sure that the new SceneView is at least rendered to once

            canvas.addEventListener("click", this.onCanvasMouseDown);

            if (this._resize_observer) this._resize_observer.unobserve(canvas);
            this._resize_observer = new ResizeObserver(() => {

                // Rerender the robotScene onto the canvas
                this.props.quaternionSpaceScene.render();
            });
            this._resize_observer.observe(canvas);
        }
    }

    /**
     * Unmounts the given canvas from the given robotScene (because of either
     * changing scenes or deleting canvas)
     */
    unmount(quaternionSpaceScene:QuaternionSpaceScene, canvas?:HTMLCanvasElement | null) {

        // Remove camera syncing
        // if (this._syncViewCallback) {
        //     this.props.robotSceneManager.removeSyncViewCallback(this._syncViewCallback);
        //     this._syncViewCallback = undefined;
        // }

        // Remove orbit view (so that it no longer is rendered to by the robot scene)
        if (this._orbitView) {
            quaternionSpaceScene.removeView(this._orbitView);
            this._orbitView = undefined;
        }

        // Remove the listeners from the camera
        if (canvas) {
            canvas.removeEventListener("click", this.onCanvasMouseDown);
            this._resize_observer?.unobserve(canvas);
        }

        this.removePointer(quaternionSpaceScene); // removes the pointer if it is in the given Scene
    }

    // ---------------
    // React Methods

    /**
     * This method is run by React every time the passed in props are
     * changed/updated.
     * @param prevProps The previous props before the update.
     */
    componentDidUpdate(prevProps:quaternion_canvas_props) {
        if (prevProps.quaternionSpaceScene !== this.props.quaternionSpaceScene) {
            // Need to remount/rebind (make this RobotCanvas show the renders of
            // the current RobotScene and no the old one) this RobotCanvas now
            // that the RobotScene has changed
            this.unmount(prevProps.quaternionSpaceScene, this._canvasRef.current);
            this.mount(this.props.quaternionSpaceScene, this._canvasRef.current);
        }
    }

    componentDidMount() {
        let tabs = document.querySelectorAll('.RobotCanvasCanvas');
        tabs.forEach(t => t.classList.remove('selected'));
        tabs = document.querySelectorAll('.GraphPanel');
        tabs.forEach(t => t.classList.remove('selected'));
        // Add the 'selected' class to the clicked tab
        this._canvasRef.current?.classList.add('selected');
        this.mount(this.props.quaternionSpaceScene, this._canvasRef.current);
    }

    componentWillUnmount() {
        this.unmount(this.props.quaternionSpaceScene, this._canvasRef.current);
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
        if(!this.props.robotSceneManager.isActiveRobotScene(droppedScene))
            this.props.robotSceneManager.activateRobotScene(droppedScene);
        let robot = droppedScene.getRobotByName(robotName);
        if(robot === undefined) return;
        const currScene = this.props.quaternionSpaceScene;
        if(partName !== undefined)  // handle the drop of a robot part button (add traces)
        {
            let robotPart: RobotLink | RobotJoint | undefined = robot.jointMap().get(partName);
            if (robotPart === undefined) {
                robotPart = robot.linkMap().get(partName);
                // if (robotPart === undefined) return;
            }

            if (currScene.hasChildTrace(robot, robotPart)) {
                //   currScene.removeChildTrace(robot, robotPart);
            } else {
                currScene.addChildTrace(
                    droppedScene, 
                    robot,
                    RobotScene.frameRange(
                        this.props.robotSceneManager.startTime(),
                        this.props.robotSceneManager.endTime()
                    ),
                    robotPart
                );
            }
        }
        else // handle the drop of a robot button (add ghosts)
        {
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