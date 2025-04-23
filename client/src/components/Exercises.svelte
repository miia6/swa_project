<script>
    import { onMount } from 'svelte';
    export let id;
    let exercises = [];

    const getExercises = async () => {
        try {
            const response = await fetch(`/api/languages/${id}/exercises`);
            const data = await response.json();
            console.log("DATA " + data)
            exercises = data;
        } catch (error) {
            console.error("Failed to fetch exercises:", error);
        }
    }

    onMount(() => {
        getExercises();
        const interval = setInterval(getExercises, 3000);
        return () => clearInterval(interval); 
    });
    //getExercises();

</script>

<ul>
    {#each exercises as exercise}
        <li><a href={`/exercises/${exercise.id}`}>{exercise.title}</a></li>
    {/each}
</ul>
