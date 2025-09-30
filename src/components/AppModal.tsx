import * as Dialog from "@radix-ui/react-dialog";

export default function AppModal({
    open, onOpenChange, title, children,
} : {
    open: boolean; onOpenChange: (v:boolean)=>void; title: string, children: React.ReactNode;
}) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay style={{ position: "fixed", inset:0, background:"rgba(0,0,0,.25)" }} />
                <Dialog.Content style={{
                    position:"fixed", left:"50%", top:"20%", transform:"translateX(-50%)",
                    background:"#fff", padding:20, borderRadius:12, width: 440, boxShadow:"0 10px 30px rgba(0,0,0,.2)"
                }}>
                    <Dialog.Title style={{ fontSize:20, fontWeight:600 }}>{title}</Dialog.Title>
                    <div style={{ marginTop:12 }}>{children}</div>
                    <div style={{ marginTop:16, textAlign:"right" }}>
                        <Dialog.Close asChild><button>Close</button></Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}