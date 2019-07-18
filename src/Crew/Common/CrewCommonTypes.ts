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
};

export type CrewCursorSystemData = {
    beatDurationInMilis: number;
    barsCount: number;
    metronom: CrewTimeSignature[];
    positions: CrewPosition[];
    duration: number;
};
