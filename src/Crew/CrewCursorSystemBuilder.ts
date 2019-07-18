import { CrewSheetMusicDisplay } from "./CrewSheetMusicDisplay";
import { GraphicalMusicSheet, GraphicalMeasure } from "../MusicalScore";
import { CrewStaveMeasureData } from "./Common/CrewStaveMeasureData";
import { Set } from "typescript-collections";
import { CrewPosition, CrewCursorSystemData } from "./Common/CrewCommonTypes";

type StaveIterator = {
    index: number;
    last: CrewPosition;
};

export class CrewCursorSystemBuilder {
    private parent: CrewSheetMusicDisplay;

    constructor(parent: CrewSheetMusicDisplay) {
        this.parent = parent;
    }

    public calculate(beatDurationInMilis: number): CrewCursorSystemData {
        const graphic: GraphicalMusicSheet = this.parent.getGraphic();
        const measureList: GraphicalMeasure[][] = this.transpose(graphic.MeasureList);
        const staveDataList: CrewStaveMeasureData[] = [];
        const staveIteratorList: StaveIterator[] = [];
        for (let i: number = 0; i < graphic.NumberOfStaves; ++i) {
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
            metronom: staveDataList[0].TimeSignatures,
            positions: []
        };

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
