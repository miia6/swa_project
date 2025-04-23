<script>
    import { onMount } from 'svelte';
    let languages = [];

    const getLanguages = async () => {
        try {
            const response = await fetch('/api/languages');
            const data = await response.json();
            console.log("DATA: " + data);
            languages = data;
        } catch (error) {
            console.error("Failed to fetch languages:", error);
        }
    }

    onMount(() => {
        getLanguages();
        const interval = setInterval(getLanguages, 3000);

        return () => clearInterval(interval); 
    });
    //getLanguages();

</script>

<ul>
    {#each languages as language}
        <li><a href={`/languages/${language.id}`}>{language.name}</a></li>
    {/each}
</ul>
