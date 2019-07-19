import { GraphicalMeasure } from "../MusicalScore";
import { CrewStaveMeasureData } from "./Common/CrewStaveMeasureData";
import { Set } from "typescript-collections";
import { CrewPosition, CrewCursorSystemData, CrewInstrument } from "./Common/CrewCommonTypes";
import { OpenSheetMusicDisplay } from "../OpenSheetMusicDisplay";

type StaveIterator = {
    index: number;
    last: CrewPosition;
};

export class CrewCursorSystemBuilder {
    public calculate(osmd: OpenSheetMusicDisplay, beatDurationInMilis: number): CrewCursorSystemData {
        const measureList: GraphicalMeasure[][] = this.transpose(osmd.getGraphic().MeasureList);
        const staveDataList: CrewStaveMeasureData[] = [];
        const staveIteratorList: StaveIterator[] = [];
        for (let i: number = 0; i < osmd.getGraphic().NumberOfStaves; ++i) {
            staveDataList.push(new CrewStaveMeasureData(i, measureList[i], beatDurationInMilis));
            staveIteratorList.push({
                index: 0,
                last: undefined,
            });
        }

        const result: CrewCursorSystemData = {
            barsCount: staveDataList[0].TotalBarsCount,
            beatDurationInMilis: beatDurationInMilis,
            duration: staveDataList.reduce((v, curr) => Math.max(v, curr.TotalDuration), 0),
            instrumentPerStave: staveIteratorList.map(x => ({
                midiId: 0,
                tempoInBPM: 100,
                volume: 1,
            })),
            metronom: staveDataList[0].TimeSignatures,
            positions: []
        };

        for (const osmdInstr of osmd.Sheet.Instruments) {
            for (const stave of osmdInstr.Staves) {
                const instr: CrewInstrument = result.instrumentPerStave[stave.idInMusicSheet];
                instr.midiId = osmdInstr.MidiInstrumentId;
                instr.volume = stave.Volume;
                instr.tempoInBPM = osmdInstr.GetMusicSheet.userStartTempoInBPM;
            }
        }

        while (true) {
            const staveIncluded: Set<number> = this.getStaveIncluded(staveDataList, staveIteratorList);
            // nothing else to process
            if (!staveIncluded) {
                break;
            }

            const position: CrewPosition = this.createNewPosition(result.positions.length);
            result.positions.push(position);

            for (let i: number = 0; i < staveDataList.length; ++i) {
                const staveIterator: StaveIterator = staveIteratorList[i];
                if (staveIncluded.contains(i)) {
                    const stavePosition: CrewPosition = staveDataList[i].Positions[staveIterator.index];
                    this.updatePosition(position, stavePosition);
                    // update last position for stave and iterator index
                    staveIterator.last = stavePosition;
                    ++staveIterator.index;
                } else if (!!staveIterator.last) {
                    position.startY = Math.min(position.startY, staveIterator.last.startY);
                    position.endY = Math.max(position.endY, staveIterator.last.endY);
                }
            }
        }
        return result;
    }

    private updatePosition(position: CrewPosition, fromPosition: CrewPosition): void {
        position.time = fromPosition.time;
        position.measureIndex = fromPosition.measureIndex;
        position.pageIndex = fromPosition.pageIndex;
        // update notes
        position.notes = position.notes.concat(fromPosition.notes);
        // update y position
        position.startY = Math.min(position.startY, fromPosition.startY);
        position.endY = Math.max(position.endY, fromPosition.endY);
        // update x position
        if (position.startX > fromPosition.startX) {
            position.startX = fromPosition.startX;
            position.width = fromPosition.width;
        }
    }

    private createNewPosition(index: number): CrewPosition {
        return {
            endY: -1,
            index: index,
            measureIndex: 0,
            notes: [],
            pageIndex: -1,
            startX: Infinity,
            startY: Infinity,
            time: 0,
            width: -1,
        };
    }

    private getStaveIncluded(staveDataList: CrewStaveMeasureData[], staveIteratorList: StaveIterator[]): Set<number> {
        let minTime: number = Infinity;
        let staveIncluded: Set<number> = undefined;
        for (let i: number = 0; i < staveDataList.length; ++i) {
            const stavePositions: CrewPosition[] = staveDataList[i].Positions;
            const staveIterator: StaveIterator = staveIteratorList[i];
            if (staveIterator.index < stavePositions.length) {
                const position: CrewPosition = stavePositions[staveIterator.index];
                if (position.time < minTime) {
                    staveIncluded = new Set();
                    staveIncluded.add(i);
                    minTime = position.time;
                } else if (Math.abs(position.time - minTime) < 0.001) {
                    staveIncluded.add(i);
                }
            }
        }
        return staveIncluded;
    }

    private transpose(measureList: GraphicalMeasure[][]): GraphicalMeasure[][] {
        return Object.keys(measureList[0]).map(c => {
            return measureList.map(r => r[c]);
        });
    }
}
