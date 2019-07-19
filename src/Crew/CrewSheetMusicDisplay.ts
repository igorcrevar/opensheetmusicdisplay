import { OpenSheetMusicDisplay } from "../OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { SvgVexFlowBackend, VexFlowMusicSheetDrawer } from "../MusicalScore/Graphical/VexFlow";
import { EngravingRules, PagePlacementEnum, GraphicalMusicSheet, GraphicalMusicPage } from "../MusicalScore";
import { CrewPageData } from "./Common/CrewCommonTypes";

export class CrewSheetMusicDisplay {
    private parent: OpenSheetMusicDisplay;
    private container: HTMLElement;
    private pageDataList: CrewPageData[];
    private pagePreviewNode: HTMLElement;

    constructor(parent: OpenSheetMusicDisplay, container: HTMLElement) {
        this.parent = parent;
        this.container = container;
    }

    public render(zoom?: number): void {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        if (!graphic) {
            throw new Error("OpenSheetMusicDisplay: Before rendering a music sheet, please load a MusicXML file");
        }

        if (zoom) {
            this.parent.zoom = zoom;
        }
        // engraving rules CREW
        EngravingRules.Rules.PagePlacement = PagePlacementEnum.Same;
        EngravingRules.Rules.PageHeight = this.container.offsetHeight / 10.0 / this.parent.zoom;

        const width: number = this.container.offsetWidth;
        this.parent.Sheet.pageWidth = width / this.parent.zoom / 10.0;

        this.fixRelativePositioning();

        graphic.reCalculate();

        this.initDrawersData(graphic.MusicPages.length);

        const maxPageHeight: number = graphic.MusicPages.reduce((max, pg) => Math.max(max, pg.PositionAndShape.BorderBottom), -1);
        const height: number = maxPageHeight * 10.0 * this.parent.zoom;

        for (let i: number = 0; i < this.pageDataList.length; ++i) {
            const data: CrewPageData = this.pageDataList[i];
            data.drawer.clear(); // clear canvas before setting width
            data.drawer.resize(width, height);
            data.drawer.scale(this.parent.zoom);
            data.drawer.drawSinglePage(graphic, graphic.MusicPages[i]);
        }

        // fix positioning
        this.fixAbsolutePositioning(width, height);
    }

    public renderPagePreview(currentPageIndex: number, nextPageIndex: number): boolean {
        if (nextPageIndex < 0 || currentPageIndex < 0 || currentPageIndex >= this.pageDataList.length || nextPageIndex >= this.pageDataList.length) {
            return false;
        }

        if (!this.pagePreviewNode) {
            this.pagePreviewNode = document.createElement("div");
            this.pagePreviewNode.className = "vfPage vfPagePreview";
            this.container.appendChild(this.pagePreviewNode);
        }

        const currentElement: HTMLElement = this.pageDataList[currentPageIndex].canvas;
        const nextElement: HTMLElement = this.pageDataList[nextPageIndex].canvas;
        const width: number = Math.floor(parseInt(currentElement.style.width, 10) / 2);
        this.pagePreviewNode.style.position = "absolute";
        this.pagePreviewNode.style.display = "block";
        this.pagePreviewNode.style.left = currentElement.style.left;
        this.pagePreviewNode.style.top = nextElement.style.top;
        this.pagePreviewNode.style.width = width + "px";
        this.pagePreviewNode.style.zIndex = "9689";
        this.pagePreviewNode.innerHTML = nextElement.innerHTML;
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

    private initDrawersData(pagesNumber: number): void {
        // remove old elements
        this.container.innerHTML = "";
        this.pageDataList = [];
        for (let i: number = 0; i < pagesNumber; ++i) {
            const backend: SvgVexFlowBackend = new SvgVexFlowBackend();
            backend.initialize(this.container);
            const canvas: HTMLElement = backend.getCanvas();
            const drawer: VexFlowMusicSheetDrawer = new VexFlowMusicSheetDrawer(canvas, backend, this.parent.DrawingParameters);
            const data: CrewPageData = {
                backend,
                canvas,
                drawer,
                height: -1,
                left: Infinity,
                top: Infinity,
                width: -1,
            };
            this.pageDataList.push(data);
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
}

