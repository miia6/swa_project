<script>
    let text = "";
    let characters = 0;
    let ifs = 0;
    let showStats = false;

    //$: characters = text.length;
    //$: ifs = (text.match(/if/g) || []).length;

    const calculateStats = () => {
        characters = text.length;
        ifs = (text.match(/if/g) || []).length;
        showStats = true;
        console.log(characters, ifs)
    };
</script>

<div>
    <textarea 
        bind:value={text} 
        placeholder="Write your code here..."
    ></textarea>

    <button onclick={calculateStats}>Submit</button>

    {#if showStats}
        <p>Characters: {characters}</p>
        <p>ifs: {ifs}</p>
    {/if}
    
</div>
