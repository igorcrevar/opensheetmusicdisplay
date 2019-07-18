import { CrewPosition } from "./Common/CrewCommonTypes";
import { CrewSheetMusicDisplay } from "./CrewSheetMusicDisplay";

export class CrewCursor {
    private domNode: HTMLElement;
    private csmd: CrewSheetMusicDisplay;
    private container: HTMLElement;

    constructor(container: HTMLElement, csmd: CrewSheetMusicDisplay) {
        this.container = container;
        this.csmd = csmd;
        this.domNode = document.createElement("div");
        this.domNode.className = "crewCursor";
        this.domNode.style.display = "none";
        container.appendChild(this.domNode);
    }

    public show(): CrewCursor {
        this.domNode.style.display = "block";
        return this;
    }

    public hide(): CrewCursor {
        this.domNode.style.display = "none";
        return this;
    }

    public remove(): void {
        if (!!this.domNode.parentNode) {
            this.domNode.parentNode.removeChild(this.domNode);
        }
    }

    public update(position: CrewPosition): void {
        this.csmd.jumpToPage(position.pageIndex, true);
        const width: number = position.width * this.csmd.getZoom();
        const height: number = (position.endY - position.startY) * this.csmd.getZoom();
        const x: number = this.container.scrollLeft + position.startX * this.csmd.getZoom();
        const y: number = position.startY * this.csmd.getZoom() + this.csmd.getYFixForPage() - 5;
        this.domNode.style.left = x + "px";
        this.domNode.style.top = y + "px";
        this.domNode.style.width = width + "px";
        this.domNode.style.height = height + "px";
        const middleX: number = this.container.scrollLeft + Math.floor(this.container.offsetWidth / 2);
        if (x > middleX) {
            this.csmd.renderPagePreview(this.csmd.getCurrentPageIndex() + 1);
        } else {
            this.csmd.hideRenderPreview();
        }
    }

    public static findPosition(positions: CrewPosition[], time: number): CrewPosition {
        let left: number = 0;
        let right: number = positions.length - 1;
        while (left <= right) {
            //var currIndex = left + Math.floor((right - left) / 2);
            const currIndex: number = Math.floor((right + left) / 2);
            const pos: CrewPosition = positions[currIndex];
            if (pos.time < time) {
                if (currIndex === positions.length - 1 || positions[currIndex + 1].time > time) {
                    return pos;
                }
                left = currIndex + 1;
            } else if (pos.time > time) {
                right = currIndex - 1;
            } else {
                return pos;
            }
        }
        return undefined;
    }
}
