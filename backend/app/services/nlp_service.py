def _load_llm(settings) -> str | None:
    """
    Initialise Hugging Face InferenceClient.

    IMPORTANT:
    The old implementation downloaded Qwen2.5 locally and loaded the model
    into Railway RAM.

    This implementation does NOT download model weights.

    It only creates a lightweight client. Actual generation happens through
    Hugging Face Inference Providers.
    """

    global _llm_client

    try:
        from huggingface_hub import InferenceClient

    except ImportError as exc:
        return (
            "huggingface_hub is not installed. "
            "Add 'huggingface_hub' to requirements.txt."
        )

    hf_token = os.getenv("HF_TOKEN")

    if not hf_token:
        return "HF_TOKEN environment variable is missing."

    # Use the project's existing Qwen 3B target.
    # The model is executed remotely through Hugging Face.
    model_name = "Qwen/Qwen2.5-3B-Instruct"

    try:
        _llm_client = InferenceClient(
            model=model_name,
            token=hf_token,
        )

        logger.info(
            "[LLM] Hugging Face InferenceClient configured: %s",
            model_name,
        )

        return None

    except Exception as exc:
        _llm_client = None

        return (
            f"Failed to initialise Hugging Face LLM client: {exc}"
        )
