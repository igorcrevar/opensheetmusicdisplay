import { VexFlowBackend, VexFlowMusicSheetDrawer } from "../../MusicalScore/Graphical/VexFlow";

export type CrewTimeSignature = {
    barIndex: number;
    beatsPerMeasure: number;
    noteDuration: number;
    realValue: number;
};

export type CrewBarData = {
    time: number;
    duration: number;
    barIndex: number;
    osmdDuration: number;
};

export type CrewNote = {
    staveIndex: number;
    barIndex: number;
    beatIndex: number;
    time: number;
    midiNote: number;
    duration: number;
    vfNote: Vex.Flow.StaveNote;
};

export type CrewPosition = {
    pageIndex: number;
    measureIndex: number;
    time: number;
    notes: CrewNote[];
    startY: number;
    endY: number;
    startX: number;
    width: number;
    index: number;
    systemIndex: number;
};

export type CrewInstrument = {
    midiId: number;
    volume: number;
    tempoInBPM: number;
};

export type CrewCursorSystemData = {
    beatDurationInMilis: number;
    barsCount: number;
    metronom: CrewTimeSignature[][];
    positions: CrewPosition[];
    duration: number;
    instrumentPerStave: CrewInstrument[];
    numberOfSystemsPerPage: number[];
};

export type CrewMusicSystemYData = {
    index: number;
    pageIndex: number;
    startY: number;
    endY: number;
};

export type CrewPageData = {
    backend: VexFlowBackend;
    canvas: HTMLElement;
    drawer: VexFlowMusicSheetDrawer;
    left: number;
    top: number;
    width: number;
    height: number;
};



