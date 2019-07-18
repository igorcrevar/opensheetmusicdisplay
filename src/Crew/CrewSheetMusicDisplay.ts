import { OpenSheetMusicDisplay } from "../OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { SvgVexFlowBackend, VexFlowMusicSheetDrawer, VexFlowBackend } from "../MusicalScore/Graphical/VexFlow";
import { EngravingRules, PagePlacementEnum, GraphicalMusicSheet, GraphicalMusicPage } from "../MusicalScore";

interface DrawersDataType {
    backend: VexFlowBackend;
    canvas: HTMLElement;
    drawer: VexFlowMusicSheetDrawer;
}

export class CrewSheetMusicDisplay {
    private parent: OpenSheetMusicDisplay;
    private container: HTMLElement;
    private drawersData: DrawersDataType[];
    private currentPageIndex: number;
    private pagesYPositionsFixes: number[];

    constructor(parent: OpenSheetMusicDisplay, container: HTMLElement) {
        this.parent = parent;
        this.container = container;
        this.currentPageIndex = 0;
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

        if (!this.drawersData || this.drawersData.length !== graphic.MusicPages.length) {
            this.initDrawersData(graphic.MusicPages.length);
        }

        const height: number = graphic.MusicPages.reduce(
            (currentMax, page) => Math.max(currentMax, page.PositionAndShape.BorderBottom),
            -1) * 10.0 * this.parent.zoom;

        for (let i: number = 0; i < this.drawersData.length; ++i) {
            const data: DrawersDataType = this.drawersData[i];
            data.drawer.clear(); // clear canvas before setting width
            data.drawer.resize(width, height);
            data.drawer.scale(this.parent.zoom);
            data.drawer.drawSinglePage(graphic, graphic.MusicPages[i]);
        }

        // fix positioning
        this.fixAbsolutePositioning(width);
    }

    public renderPagePreview(nextPageIndex: number, currentPageIndex?: number): boolean {
        currentPageIndex = currentPageIndex || this.currentPageIndex;
        let currentElement: HTMLElement;
        let nextElement: HTMLElement;
        let pagePreviewNode: HTMLElement;
        const currentPageId: string = "vfPage_" + currentPageIndex;
        const nextPageId: string = "vfPage_" + nextPageIndex;
        for (let i: number = 0; i < this.container.children.length; ++i) {
            const child: HTMLElement = <HTMLElement>this.container.children[i];
            const id: string = child.getAttribute("id");
            if (id === currentPageId) {
                currentElement = child;
            } else if (id === nextPageId) {
                nextElement = child;
            } else if (child.className.indexOf("vfPagePreview") !== -1) {
                pagePreviewNode = child;
            }
        }

        let result: boolean = false;
        if (!!currentElement && !!nextElement) {
            if (!pagePreviewNode) {
                pagePreviewNode = document.createElement("div");
                pagePreviewNode.className = "vfPage vfPagePreview";
                this.container.appendChild(pagePreviewNode);
            }
            const width: number = Math.floor(parseInt(currentElement.style.width, 10) / 2);
            pagePreviewNode.style.position = "absolute";
            pagePreviewNode.style.display = "block";
            pagePreviewNode.style.left = currentElement.style.left;
            pagePreviewNode.style.top = nextElement.style.top;
            pagePreviewNode.style.width = width + "px";
            pagePreviewNode.style.zIndex = "9689";
            pagePreviewNode.innerHTML = nextElement.innerHTML;
            result = true;
        }
        return result;
    }

    public hideRenderPreview(): void {
        for (let i: number = 0; i < this.container.children.length; ++i) {
            const child: HTMLElement = <HTMLElement>this.container.children[i];
            if (child.className.indexOf("vfPagePreview") !== -1) {
                child.style.display = "none";
            }
        }
    }

    public getZoom(): number {
        return this.parent.zoom;
    }

    public getNumberOfPages(): number {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        return !!graphic ? graphic.MusicPages.length : 0;
    }

    public getCurrentPageIndex(): number {
        return this.currentPageIndex;
    }

    public getGraphic(): GraphicalMusicSheet {
        return this.parent.getGraphic();
    }

    public getYFixForPage(pageIndex?: number): number {
        return this.pagesYPositionsFixes[pageIndex || this.currentPageIndex];
    }

    public jumpToPage(pageIndex: number, force?: boolean): boolean {
        if (this.currentPageIndex !== pageIndex || force) {
            this.currentPageIndex = pageIndex;
            const nextPageId: string = "vfPage_" + pageIndex;
            for (let i: number = 0; i < this.container.children.length; ++i) {
                const child: HTMLElement = <HTMLElement>this.container.children[i];
                const id: string = child.getAttribute("id");
                if (id === nextPageId) {
                    this.container.scrollLeft = parseInt(child.style.left, 10);
                    return true;
                }
            }
        }

        return false;
    }

    private initDrawersData(pagesNumber: number): void {
        // remove old elements
        if (!!this.drawersData) {
            for (const data of this.drawersData) {
                this.container.removeChild(data.backend.getInnerElement());
            }
        }

        this.drawersData = [];
        this.container.innerHTML = "";
        for (let i: number = 0; i < pagesNumber; ++i) {
            const backend: SvgVexFlowBackend = new SvgVexFlowBackend();
            backend.initialize(this.container);
            const canvas: HTMLElement = backend.getCanvas();
            const drawer: VexFlowMusicSheetDrawer = new VexFlowMusicSheetDrawer(canvas, backend, this.parent.DrawingParameters);
            const data: DrawersDataType = {
                backend,
                canvas,
                drawer,
            };
            this.drawersData.push(data);
        }
    }

    private fixRelativePositioning(): void {
        if (!!this.drawersData) {
            for (let i: number = 0; i <  this.drawersData.length; ++i) {
                const data: DrawersDataType = this.drawersData[i];
                data.canvas.setAttribute("style", "position: relative; z-index: 0;");
                data.canvas.className = "";
            }
        }
    }

    private fixAbsolutePositioning(width: number): void {
        // we must align all pages to the page with "lowest" first staff line
        const pages: GraphicalMusicPage[] = this.parent.getGraphic().MusicPages;
        const topUpper: number = pages.reduce(
            (currentMax, page) => Math.max(currentMax, page.MusicSystems[0].StaffLines[0].PositionAndShape.AbsolutePosition.y),
            -1);

        this.pagesYPositionsFixes = [];
        for (let i: number = 0; i <  this.drawersData.length; ++i) {
            const data: DrawersDataType = this.drawersData[i];
            const page: GraphicalMusicPage = pages[i];
            data.canvas.id = "vfPage_" + i;
            data.canvas.className = "vfPage";
            data.canvas.removeAttribute("style");
            data.canvas.style.position = "absolute";
            data.canvas.style.left = (i * width) + "px";
            const topOffset: number = topUpper - page.MusicSystems[0].StaffLines[0].PositionAndShape.AbsolutePosition.y;
            const topPixels: number = topOffset * 10 * this.parent.zoom;
            data.canvas.style.top = topPixels + "px";
            data.canvas.style.width = width + "px";
            this.pagesYPositionsFixes.push(topPixels);
        }
    }
}
