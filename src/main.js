import { Tauri } from '@Tauri';
import { loadGlobals } from '@Globals';

(async () => {
    await loadGlobals();

    import('./Sources/main.js').then(async ({ start }) => {
        await resize();
        await start();
    });
})();


async function resize(){
    Tauri.resize(900, 650).then(() => {
        console.log('Window resized to 900x650');
    });
    $('#Loading-Screen').fadeOut(500, function() {
        $(this).remove();
    });
}