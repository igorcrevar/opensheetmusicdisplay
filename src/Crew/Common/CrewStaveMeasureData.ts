import { CrewTimeSignature, CrewPosition, CrewMusicSystemYData } from "./CrewCommonTypes";
import { GraphicalMeasure, GraphicalStaffEntry, GraphicalNote, SourceMeasure, Note } from "../../MusicalScore";
import { VexFlowGraphicalNote, VexFlowMeasure } from "../../MusicalScore/Graphical/VexFlow";
import { AbstractNotationInstruction, RhythmInstruction } from "../../MusicalScore/VoiceData/Instructions";

const defaultTimeSignature: CrewTimeSignature = {
    barIndex: 0,
    beatsPerMeasure: 4,
    noteDuration: 4,
    realValue: 1,
};

export class CrewStaveMeasureData {
    private staveIndex: number;

    private timeSignatures: CrewTimeSignature[];
    private positions: CrewPosition[];
    private totalDuration: number;

    private bars: GraphicalMeasure[];
    private musicSystemData: CrewMusicSystemYData[];

    constructor(staveIndex: number, bars: GraphicalMeasure[], musicSystemData: CrewMusicSystemYData[], beatDurationInMilis: number) {
        this.staveIndex = staveIndex;
        this.bars = bars;
        this.musicSystemData = musicSystemData;

        this.process(beatDurationInMilis);
    }

    public get TotalBarsCount(): number {
        return this.bars.length;
    }

    public get TotalDuration(): number {
        return this.totalDuration;
    }

    public get StaveIndex(): number {
        return this.staveIndex;
    }

    public get TimeSignatures(): CrewTimeSignature[] {
        return this.timeSignatures;
    }

    public get LastTimeSignature(): CrewTimeSignature {
        return this.timeSignatures.last();
    }

    public get LastPosition(): CrewPosition {
        return this.positions.last();
    }

    public get Positions(): CrewPosition[] {
        return this.positions;
    }

    private process(beatDurationInMilis: number): void {
        this.totalDuration = 0;
        this.positions = [];
        this.timeSignatures = [];

        for (let i: number = 0; i < this.bars.length; ++i) {
            const bar: VexFlowMeasure = <VexFlowMeasure>this.bars[i];
            const sourceMeasure: SourceMeasure = bar.parentSourceMeasure;
            this.updateTimeSignaturesIfNeeded(i, sourceMeasure);
            if (this.timeSignatures.length === 0) {
                this.timeSignatures.push(defaultTimeSignature);
            }

            const timeSignature: CrewTimeSignature = this.timeSignatures.last();
            const beatsPerBar: number = timeSignature.beatsPerMeasure * (sourceMeasure.Duration.RealValue / timeSignature.realValue);
            const barDuration: number = beatDurationInMilis * beatsPerBar;
            const barTime: number = this.totalDuration;
            this.totalDuration += barDuration;
            for (let j: number = 0; j < bar.staffEntries.length; ++j) {
                const staffEntry: GraphicalStaffEntry = bar.staffEntries[j];
                const relInMeasure: number = staffEntry.relInMeasureTimestamp.RealValue;
                const time: number = barTime + relInMeasure / sourceMeasure.Duration.RealValue * barDuration;
                const beatIndex: number = relInMeasure !== 0 ? Math.floor(beatsPerBar * relInMeasure / sourceMeasure.Duration.RealValue) : 0;

                const lastPosition: CrewPosition = {
                    endY: -1,
                    index: this.positions.length,
                    measureIndex: i,
                    notes: [],
                    pageIndex: -1,
                    startX: Infinity,
                    startY: Infinity,
                    systemIndex: -1,
                    time: time,
                    width: Infinity,
                };

                // if stave is not rendered, then we can not have graphical data (pageIndex, xy coords etc)
                if (!!bar.parentMusicSystem) {
                    const musicSystemData: CrewMusicSystemYData = this.musicSystemData[bar.parentMusicSystem.Id];
                    lastPosition.startY = musicSystemData.startY;
                    lastPosition.endY = musicSystemData.endY;
                    lastPosition.pageIndex = musicSystemData.pageIndex;
                    lastPosition.systemIndex = musicSystemData.index;
                }

                let positionHasVisibleNotes: boolean = false;
                for (let u: number = 0; u < staffEntry.graphicalVoiceEntries.length; ++u) {
                    const notes: GraphicalNote[] = staffEntry.graphicalVoiceEntries[u].notes;
                    for (let v: number = 0; v < notes.length; ++v) {
                        const graphicalNote: GraphicalNote = notes[v];
                        const sourceNote: Note = graphicalNote.sourceNote;
                        if (!sourceNote.PrintObject) {
                            continue;
                        }
                        if (!positionHasVisibleNotes) {
                            positionHasVisibleNotes = true;
                            this.positions.push(lastPosition);
                        }
                        lastPosition.notes.push({
                            barIndex: i,
                            beatIndex: beatIndex,
                            duration: sourceNote.Length.RealValue / sourceMeasure.Duration.RealValue * barDuration,
                            midiNote: sourceNote.isRest() ? -1 : sourceNote.Pitch.getHalfTone(),
                            staveIndex: this.staveIndex,
                            time: lastPosition.time,
                            vfNote: undefined,
                        });

                        if (lastPosition.systemIndex !== -1 && (graphicalNote instanceof VexFlowGraphicalNote)) {
                            const vfNote: Vex.Flow.StaveNote = (<VexFlowGraphicalNote>graphicalNote).vfnote[0]; // vfnote is tuple
                            const noteHeads: SVGGraphicsElement[] = this.getNoteNoteHeads(vfNote);
                            // update start x position and width
                            for (let nh: number = 0; nh < noteHeads.length; ++nh) {
                                const tbb: any = noteHeads[nh].getBBox();
                                if (lastPosition.startX > tbb.x) {
                                    lastPosition.startX = tbb.x;
                                    lastPosition.width = tbb.width;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private getNoteNoteHeads(note: Vex.Flow.StaveNote): SVGGraphicsElement[] {
        const noteHeads: SVGGraphicsElement[] = [];
        const noteElement: SVGGraphicsElement = note.getAttribute("el");
        for (let i: number = 0; i < noteElement.children.length; ++i) {
            const ch: SVGGraphicsElement = <SVGGraphicsElement>noteElement.children[i];
            if (ch.className) {
                if (ch.className.baseVal === "vf-note") {
                    for (let j: number = 0; j < ch.children.length; ++j) {
                        const ch2: SVGGraphicsElement = <SVGGraphicsElement>ch.children[j];
                        if (ch2.className && (ch2.className.baseVal === "vf-notehead")) {
                            noteHeads.push(ch2);
                        }
                    }
                } else if (ch.className.baseVal === "vf-notehead") {
                    noteHeads.push(ch);
                }
            }
        }
        return noteHeads;
    }

    private updateTimeSignaturesIfNeeded(barIndex: number, sourceMeasure: SourceMeasure): void {
        if (sourceMeasure.FirstInstructionsStaffEntries[this.staveIndex] !== undefined) {
            const instruction: AbstractNotationInstruction = sourceMeasure.FirstInstructionsStaffEntries[this.staveIndex].Instructions.last();
            if (instruction instanceof RhythmInstruction) {
                const rhythmInstruction: RhythmInstruction = <RhythmInstruction>instruction;
                // set this.lastTimeSignature
                this.timeSignatures.push({
                    barIndex: barIndex,
                    beatsPerMeasure: rhythmInstruction.Numerator,
                    noteDuration: rhythmInstruction.Denominator,
                    realValue: rhythmInstruction.Rhythm.RealValue
                });
            }
        }
    }
}
