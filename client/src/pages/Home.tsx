import AppModal from "../components/AppModal.tsx";
import { useStandings } from "../hooks/useStandings.ts";
import {
    DEFAULT_LEAGUE_ID,
    CURRENT_FANTASY_SEASON,
} from "../config/fantasy";
import { useUi } from "../stores/ui";

export default function Home() {
    const open = useUi(s=>s.modalOpen);
    const onOpen = useUi(s=>s.open);
    const onClose = useUi(s=>s.close);

    const {
        data: standings,
        isLoading,
        isError,
        error,
    } = useStandings({
        leagueId: DEFAULT_LEAGUE_ID,
        season: CURRENT_FANTASY_SEASON,
        week: 1,
    });
    return (
        <div>
            <h1>Fantasy Football Dashboard</h1>
            {isLoading && <p>Loading standings...</p>}
            {isError && (
                <p>Failed to load standings: {(error as Error).message}</p>
            )}

            {standings && (
                <pre>
                    {JSON.stringify(standings, null, 2)}
                </pre>
            )}
            <button onClick={onOpen} style={{ marginTop: 12 }}>Open Modal</button>
            <AppModal open={open} onOpenChange={(v)=> v ? onOpen() : onClose()} title="Hello">
                This modal is accessible
            </AppModal>
            <p>League import and projections</p>
        </div>
    );
}