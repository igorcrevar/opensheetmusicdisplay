import { CrewPosition, CrewCursorSystemData, CrewPageData } from "./Common/CrewCommonTypes";
import { CrewSheetMusicDisplay } from "./CrewSheetMusicDisplay";
import { CrewCursorSystemBuilder } from "./CrewCursorSystemBuilder";

export class CrewCursor {
    private domNode: HTMLElement;
    private csmd: CrewSheetMusicDisplay;
    private container: HTMLElement;
    private builder: CrewCursorSystemBuilder;
    private cursorData: CrewCursorSystemData;
    private currentPositionIndex: number;
    private isInPlayMode: boolean;
    private halfPageCorrectionInPixels: number;

    constructor(container: HTMLElement, csmd: CrewSheetMusicDisplay, builder: CrewCursorSystemBuilder, halfPageCorrectionInPixels: number = 10) {
        this.container = container;
        this.csmd = csmd;
        this.builder = builder;
        this.isInPlayMode = false;
        this.currentPositionIndex = -1;
        this.halfPageCorrectionInPixels = halfPageCorrectionInPixels;
    }

    public show(): CrewCursor {
        this.domNode.style.display = "block";
        return this;
    }

    public hide(): CrewCursor {
        this.domNode.style.display = "none";
        return this;
    }

    public add(): CrewCursor {
        this.remove();
        this.domNode = document.createElement("div");
        this.domNode.className = "crewCursor";
        this.domNode.style.display = "none";
        this.container.appendChild(this.domNode);
        return this;
    }

    public remove(): void {
        if (!!this.domNode && !!this.domNode.parentNode) {
            this.domNode.parentNode.removeChild(this.domNode);
        }
    }

    public init(beatDurationInMilis: number, show: boolean, skipStaves: number[]): void {
        this.cursorData = this.builder.calculate(this.csmd.getOsmd(), beatDurationInMilis, skipStaves);
        if (show) {
            this.add().show();
            const isValidPosition: boolean = this.currentPositionIndex >= 0 && this.currentPositionIndex < this.cursorData.positions.length;
            // we must call setPositionIndex in any case because we need to update cursor dom data
            this.setPositionIndex(isValidPosition ? this.currentPositionIndex : 0);
        }
    }

    public set IsInPlayMode(isInPlayMode: boolean) {
        this.isInPlayMode = isInPlayMode;
    }

    public get Data(): CrewCursorSystemData {
        return this.cursorData;
    }

    public get CurrentPosition(): CrewPosition {
        return !!this.cursorData && this.currentPositionIndex !== -1 ? this.cursorData.positions[this.currentPositionIndex] : undefined;
    }

    public setTime(time: number, forceJumpToPage: boolean = true): void {
        const position: CrewPosition = this.findPosition(time);
        if (!!position) {
            this.setPosition(position, forceJumpToPage);
        }
    }

    public setPositionIndex(index: number, forceJumpToPage: boolean = true): void {
        if (!!this.cursorData && index < this.cursorData.positions.length && index >= 0) {
            this.setPosition(this.cursorData.positions[index], forceJumpToPage);
        }
    }

    public onClickHandler(event: MouseEvent): void {
        if (!this.cursorData) {
            return;
        }
        let dist: number = Infinity;
        let resultPosition: CrewPosition = undefined;
        const positions: CrewPosition[] = this.cursorData.positions;
        const zoom: number = this.csmd.getZoom();
        const rect: ClientRect | DOMRect = this.container.getBoundingClientRect();
        const mouseX: number = event.clientX - rect.left + this.container.scrollLeft;
        const mouseY: number = event.clientY - rect.top + this.container.scrollTop;
        const pagesData: CrewPageData[] = this.csmd.getPagesData();

        // find page
        let desiredPage: number = 0;
        for (let i: number = 1; i < pagesData.length; ++i) {
            const pg: CrewPageData = pagesData[i];
            if (pg.left <= mouseX && mouseX < pg.left + pg.width) {
                desiredPage = i;
                break;
            }
        }

        for (let i: number = 0; i < positions.length; ++i) {
            const pos: CrewPosition = positions[i];
            if (pos.pageIndex === desiredPage) {
                const page: CrewPageData = pagesData[pos.pageIndex];
                const yMin: number = page.top + pos.startY * zoom;
                const yMax: number = page.top + pos.endY * zoom;
                const xMin: number = page.left + pos.startX * zoom;
                const xMax: number = page.left + (pos.startX + pos.width) * zoom;
                // https://stackoverflow.com/questions/5254838/calculating-distance-between-a-point-and-a-rectangular-box-nearest-point
                const dx: number = Math.max(xMin - mouseX, 0, mouseX - xMax);
                const dy: number = Math.max(yMin - mouseY, 0, mouseY - yMax);
                const newDist: number = dx * dx + dy * dy;
                if (newDist < dist) {
                    resultPosition = pos;
                    dist = newDist;
                }
            } else if (pos.pageIndex > desiredPage) {
                break;
            }
        }

        this.setPosition(resultPosition, false);
    }

    public findPosition(time: number): CrewPosition {
        const positions: CrewPosition[] = this.cursorData.positions;
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

    private setPosition(position: CrewPosition, forceJumpToPage: boolean): void {
        // position.pageIndex is -1 if current position is not shown (hidden)
        // this position can not be set to current, it should be only used for playing etc
        if (position.pageIndex === -1) {
            let i: number = position.index - 1;
            while (i >= 0 && this.cursorData.positions[i].pageIndex === -1) {
                --i;
            }
            if (i >= 0) {
                position = this.cursorData.positions[i];
            } else {
                i = position.index + 1;
                while (i < this.cursorData.positions.length && this.cursorData.positions[i].pageIndex === -1) {
                    ++i;
                }
                if (i < this.cursorData.positions.length) {
                    position = this.cursorData.positions[i];
                } else {
                    return; // there aren't any position which is displayed
                }
            }
        }

        this.currentPositionIndex = position.index;
        if (this.isInPlayMode || forceJumpToPage) {
            this.csmd.jumpToPage(position.pageIndex);
        }
        const pageData: CrewPageData = this.csmd.getPageData(position.pageIndex);
        const systemsPerPage: number = this.cursorData.numberOfSystemsPerPage[position.pageIndex];
        const width: number = position.width * this.csmd.getZoom();
        const height: number = (position.endY - position.startY) * this.csmd.getZoom();
        const x: number = pageData.left + position.startX * this.csmd.getZoom();
        const y: number = (position.startY - 5) * this.csmd.getZoom() + pageData.top; // 5 is some constant
        this.domNode.style.left = x + "px";
        this.domNode.style.top = y + "px";
        this.domNode.style.width = width + "px";
        this.domNode.style.height = height + "px";
        if (this.isInPlayMode) {
            if (systemsPerPage === 1 && x > pageData.left + this.halfPageCorrectionInPixels + Math.floor(pageData.width / 2)) {
                this.csmd.renderPagePreview(position.pageIndex, position.pageIndex + 1, true);
            } else if (systemsPerPage > 1 && position.systemIndex === systemsPerPage - 1) {
                this.csmd.renderPagePreview(position.pageIndex, position.pageIndex + 1, false);
            } else {
                this.csmd.hideRenderPreview();
            }
        } else {
            this.csmd.hideRenderPreview();
        }
    }
}
