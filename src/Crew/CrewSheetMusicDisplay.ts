import { OpenSheetMusicDisplay } from "../OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { SvgVexFlowBackend, VexFlowMusicSheetDrawer } from "../MusicalScore/Graphical/VexFlow";
import { EngravingRules, GraphicalMusicSheet, GraphicalMusicPage, Instrument } from "../MusicalScore";
import { CrewPageData } from "./Common/CrewCommonTypes";

const PREVIEW_X_CORRECTION: number = 0;
const FIT_TO_ZOOM_Y_CORRECTION: number = 25;

export class CrewSheetMusicDisplay {
    private parent: OpenSheetMusicDisplay;
    private container: HTMLElement;
    private drawer: VexFlowMusicSheetDrawer;
    private pageDataList: CrewPageData[];
    private pagePreviewNode: HTMLElement;

    constructor(parent: OpenSheetMusicDisplay, container: HTMLElement) {
        this.parent = parent;
        this.container = container;
    }

    public render(zoom?: number, resizeToScreen: boolean = false): void {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        if (!graphic) {
            throw new Error("OpenSheetMusicDisplay: Before rendering a music sheet, please load a MusicXML file");
        }

        if (zoom) {
            this.parent.zoom = zoom;
        }
        // engraving rules CREW
        EngravingRules.Rules.PageHeight = this.container.offsetHeight / 10.0 / this.parent.zoom;

        const width: number = this.container.offsetWidth;
        this.parent.Sheet.pageWidth = width / this.parent.zoom / 10.0;

        this.fixRelativePositioning();

        graphic.reCalculate();

        this.initDrawersData(graphic.MusicPages.length);

        let height: number;
        if (resizeToScreen) {
            height = this.container.offsetHeight;
        } else {
            const maxPageHeight: number = graphic.MusicPages.reduce((max, pg) => Math.max(max, pg.PositionAndShape.BorderBottom), -1);
            height = maxPageHeight * 10.0 * this.parent.zoom;
        }

        for (let i: number = 0; i < this.pageDataList.length; ++i) {
            const data: CrewPageData = this.pageDataList[i];
            data.backend.clear(); // clear canvas before setting width
            data.backend.resize(width, height);
            data.backend.scale(this.parent.zoom);
            this.drawer.drawSinglePage(graphic, graphic.MusicPages[i]);
        }

        // fix positioning
        this.fixAbsolutePositioning(width, height);
    }

    public renderPagePreview(currentPageIndex: number, nextPageIndex: number, isHorizontal: boolean = true): boolean {
        if (nextPageIndex < 0 || currentPageIndex < 0 || currentPageIndex >= this.pageDataList.length || nextPageIndex >= this.pageDataList.length) {
            return false;
        }

        if (!this.pagePreviewNode) {
            this.pagePreviewNode = document.createElement("div");
            this.container.appendChild(this.pagePreviewNode);
        } else if (this.container.getElementsByClassName("vfPagePreview").length === 0) {
            this.container.appendChild(this.pagePreviewNode);
        }

        this.pagePreviewNode.className = "vfPage vfPagePreview " + (isHorizontal ? "vfPagePreviewHorizontal" : "vfPagePreviewVertical");
        const currentPage: CrewPageData = this.pageDataList[currentPageIndex];
        const nextPage: CrewPageData = this.pageDataList[nextPageIndex];
        const width: number = isHorizontal ? Math.floor(currentPage.width / 2) : Math.max(nextPage.width, currentPage.width);
        const height: number = !isHorizontal ? Math.floor(currentPage.height / 2) : Math.max(nextPage.height, currentPage.height);
        this.pagePreviewNode.style.position = "absolute";
        this.pagePreviewNode.style.display = "block";
        this.pagePreviewNode.style.left = (currentPage.left + (currentPageIndex === 0 ? PREVIEW_X_CORRECTION : 0)) + "px";
        this.pagePreviewNode.style.top = nextPage.top + "px";
        this.pagePreviewNode.style.width = width + "px";
        this.pagePreviewNode.style.height = height + "px";
        this.pagePreviewNode.style.zIndex = "9689";
        this.pagePreviewNode.innerHTML = nextPage.canvas.innerHTML;
        return true;
    }

    public hideRenderPreview(): void {
        if (!!this.pagePreviewNode) {
            this.pagePreviewNode.style.display = "none";
        }
    }

    public getZoom(): number {
        return this.parent.zoom;
    }

    public getNumberOfPages(): number {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        return !!graphic ? graphic.MusicPages.length : 0;
    }

    public getOsmd(): OpenSheetMusicDisplay {
        return this.parent;
    }

    public getGraphic(): GraphicalMusicSheet {
        return this.parent.getGraphic();
    }

    public getPageData(pageIndex: number): CrewPageData {
        return this.pageDataList[pageIndex];
    }

    public getPagesData(): CrewPageData[] {
        return this.pageDataList;
    }

    public jumpToPage(pageIndex: number): boolean {
        if (pageIndex >= 0 && pageIndex < this.pageDataList.length) {
            const pageData: CrewPageData = this.pageDataList[pageIndex];
            this.container.scrollLeft = parseInt(pageData.canvas.style.left, 10);
            return true;
        }
        return false;
    }

    public fitToScreenZoom(render: boolean): number {
        const reduceFunc: any = (currMax: number, item: CrewPageData): number => {
            const svgElement: SVGElement = item.canvas.getElementsByTagName("svg")[0];
            for (let i: number = 0; i < svgElement.children.length; ++i) {
                const child: Element = svgElement.children[i];
                if (child instanceof SVGGraphicsElement) {
                    const childSvg: SVGGraphicsElement = <SVGGraphicsElement>child;
                    currMax = Math.max(childSvg.getBBox().y + childSvg.getBBox().height, currMax);
                }
            }
            return currMax;
        };
        const maxBottomPosition: number = this.pageDataList.reduce(reduceFunc, 0) + FIT_TO_ZOOM_Y_CORRECTION;
        const newZoom: number = this.container.offsetHeight / maxBottomPosition;
        if (render) {
            this.render(newZoom, true);
        }
        return newZoom;
    }

    private initDrawersData(pagesNumber: number): void {
        // remove old elements
        this.container.innerHTML = "";
        this.pageDataList = [];
        this.drawer = new VexFlowMusicSheetDrawer(this.parent.DrawingParameters);
        for (let i: number = 0; i < pagesNumber; ++i) {
            const backend: SvgVexFlowBackend = new SvgVexFlowBackend();
            backend.initialize(this.container);
            const canvas: HTMLElement = backend.getCanvas();
            const data: CrewPageData = {
                backend,
                canvas,
                height: -1,
                left: Infinity,
                top: Infinity,
                width: -1,
            };
            this.pageDataList.push(data);
            this.drawer.Backends.push(backend);
        }
    }

    private fixRelativePositioning(): void {
        if (!!this.pageDataList) {
            for (let i: number = 0; i <  this.pageDataList.length; ++i) {
                const data: CrewPageData = this.pageDataList[i];
                data.canvas.setAttribute("style", "position: relative; z-index: 0;");
                data.canvas.className = "";
            }
        }
    }

    private fixAbsolutePositioning(width: number, height: number): void {
        // we must align all pages to the page with "lowest" first staff line
        const pages: GraphicalMusicPage[] = this.parent.getGraphic().MusicPages;
        const topUpper: number = pages.reduce(
            (currentMax, page) => Math.max(currentMax, page.MusicSystems[0].StaffLines[0].PositionAndShape.AbsolutePosition.y),
            -1);

        for (let i: number = 0; i <  this.pageDataList.length; ++i) {
            const data: CrewPageData = this.pageDataList[i];
            const page: GraphicalMusicPage = pages[i];
            const topOffset: number = topUpper - page.MusicSystems[0].StaffLines[0].PositionAndShape.AbsolutePosition.y;
            data.height = height;
            data.width = width;
            data.top = topOffset * 10 * this.parent.zoom;
            data.left = i * width;

            data.canvas.id = "vfPage_" + i;
            data.canvas.className = "vfPage";
            data.canvas.removeAttribute("style");
            data.canvas.style.position = "absolute";
            data.canvas.style.left = data.left + "px";
            data.canvas.style.top = data.top + "px";
            data.canvas.style.width = width + "px";
        }
    }

    public showInstruments(shown: (string|number)[]): void {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        for (let i: number = 0; i < graphic.ParentMusicSheet.Instruments.length; ++i) {
            const instrument: Instrument = graphic.ParentMusicSheet.Instruments[i];
            instrument.Visible = !shown || shown.contains(i) ||
                shown.contains(!!instrument.Name ? instrument.Name.toLowerCase() : "");
        }
    }
}

