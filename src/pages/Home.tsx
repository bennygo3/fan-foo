import AppModal from "../components/AppModal.tsx";
import { useUi } from "../stores/ui";

export default function Home() {
    const open = useUi(s=>s.modalOpen);
    const onOpen = useUi(s=>s.open);
    const onClose = useUi(s=>s.close);
    return (
        <div>
            <h1>Fantasy Football Dashboard</h1>
            <button onClick={onOpen} style={{ marginTop: 12 }}>Open Modal</button>
            <AppModal open={open} onOpenChange={(v)=> v ? onOpen() : onClose()} title="Hello">
                This modal is accessible
            </AppModal>
            <p>League import and projections</p>
        </div>
    );
}