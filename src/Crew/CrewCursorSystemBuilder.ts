import { GraphicalMeasure, MusicSystem, GraphicalMusicPage } from "../MusicalScore";
import { CrewStaveMeasureData } from "./Common/CrewStaveMeasureData";
import { CrewPosition, CrewCursorSystemData, CrewInstrument, CrewMusicSystemYData } from "./Common/CrewCommonTypes";
import { OpenSheetMusicDisplay } from "../OpenSheetMusicDisplay";
import { VexFlowMeasure } from "../MusicalScore/Graphical/VexFlow";

export class CrewCursorSystemBuilder {
    public calculate(osmd: OpenSheetMusicDisplay, beatDurationInMilis: number): CrewCursorSystemData {
        const measureList: GraphicalMeasure[][] = this.transpose(osmd.getGraphic().MeasureList);
        const staveDataList: CrewStaveMeasureData[] = [];
        const staveIteratorList: number[] = [];
        const musicSystemData: CrewMusicSystemYData[] = this.getMusicSystemData(osmd);
        for (let i: number = 0; i < osmd.getGraphic().NumberOfStaves; ++i) {
            staveDataList.push(new CrewStaveMeasureData(i, measureList[i], musicSystemData, beatDurationInMilis));
            staveIteratorList.push(0); // for each stave iterator index is set to zero (first position)
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
            metronom: staveDataList.map(x => x.TimeSignatures),
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
            const staveIncluded: CrewPosition[] = this.getStaveIncluded(staveDataList, staveIteratorList);
            // nothing else to process
            if (!staveIncluded) {
                break;
            }

            const position: CrewPosition = this.createNewPosition(result.positions.length);
            result.positions.push(position);

            for (let i: number = 0; i < staveIncluded.length; ++i) {
                const stavePosition: CrewPosition = staveIncluded[i];
                this.updatePosition(position, stavePosition);
                ++staveIteratorList[stavePosition.notes[0].staveIndex];
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

    private getStaveIncluded(staveDataList: CrewStaveMeasureData[], staveIteratorList: number[]): CrewPosition[] {
        let minTime: number = Infinity;
        let staveIncluded: CrewPosition[] = undefined;
        for (let i: number = 0; i < staveDataList.length; ++i) {
            const stavePositions: CrewPosition[] = staveDataList[i].Positions;
            const staveIterator: number = staveIteratorList[i];
            if (staveIterator < stavePositions.length) {
                const position: CrewPosition = stavePositions[staveIterator];
                if (position.time < minTime) {
                    staveIncluded = [position];
                    minTime = position.time;
                } else if (Math.abs(position.time - minTime) < 0.001) {
                    staveIncluded.push(position);
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

    private getMusicSystemData(osmd: OpenSheetMusicDisplay): CrewMusicSystemYData[] {
        const result: CrewMusicSystemYData[] = [];
        const musicPages: GraphicalMusicPage[] = osmd.getGraphic().MusicPages;
        for (let pageIndex: number = 0; pageIndex < musicPages.length; ++pageIndex) {
            const musicPage: GraphicalMusicPage = musicPages[pageIndex];
            for (let i: number = 0; i < musicPage.MusicSystems.length; ++i) {
                const ms: MusicSystem = musicPage.MusicSystems[i];
                const barTop: VexFlowMeasure = <VexFlowMeasure>ms.GraphicalMeasures[0][0];
                const barBottom: VexFlowMeasure = <VexFlowMeasure>ms.GraphicalMeasures[0].last();
                result.push({
                    endY: barBottom.getVFStave().getBottomLineY(),
                    index: i,
                    pageIndex: pageIndex,
                    startY: barTop.getVFStave().getTopLineTopY(),
                });
            }
        }
        return result;
    }
}
