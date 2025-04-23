<script>
    import { onMount } from 'svelte';
    export let id;

    let title = '';
    let description = '';

    const getExercise = async () => {
        try {
            const response = await fetch(`/api/exercises/${id}`);
            const data = await response.json();
            //console.log("DATA: " + JSON.stringify(data));
            title = data.title;
            description = data.description;
        } catch (error) {
            console.error("Failed to fetch exercise: ", error);
        }
    }

    onMount(() => {
        getExercise();
        const interval = setInterval(getExercise, 3000);

        return () => clearInterval(interval); 
    });

    let text = "";
    let submissionId = 0;
    const sendExercise = async () => {
        try {
            //console.log("TEXT: " + text, id);
            const response = await fetch(`/api/exercises/${id}/submissions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ source_code: text }),
            });

            const data = await response.json();
            console.log("POST SUBMISSION DATA: " + JSON.stringify(data));
            submissionId = data.id;

            //await fetch("/grader-api/consume/enable", { method: "POST" });
            getStatus();

            text = "";
        } catch (error) {
            console.error("Failed to send exercise: ", error);
        }
    }

    let status = "pending";
    let grade = 0;

    const getStatus = async () => {
        let done = false;
        try {
            while (!done) {
                const response = await fetch(`/api/submissions/${submissionId}/status`);
                const data = await response.json();
                console.log("STATUS DATA: " + JSON.stringify(data));
                status = data.grading_status;
                grade = data.grade;

                if (status === "graded") {
                    done = true;
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }

        } catch (error) {
            console.error("Failed to fetch status: ", error);
        }
    }

</script>

<h1>{title}</h1>
<p>{description}</p>

<div>
    <textarea
        bind:value={text}
        placeholder="Write your code here..."
    ></textarea>  
    <button onclick={() => sendExercise()}>Submit</button>
</div>

<p>Grading status: {status}</p>
<p>Grade: {grade}</p>
