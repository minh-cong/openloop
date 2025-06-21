import { InputForm } from "./InputForm";

interface WelcomeScreenProps {
  handleSubmit: (
    submittedInputValue: string,
    effort: string,
    model: string,
    useMultiAgent?: boolean
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  handleSubmit,
  onCancel,
  isLoading,
}) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-8 flex-1 w-full max-w-4xl mx-auto gap-8">
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-600 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        <h1 className="relative text-6xl md:text-7xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-300 bg-clip-text text-transparent mb-6">
          OpenLoop Research
        </h1>
      </div>
      <p className="text-xl md:text-2xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
        Advanced AI research assistant with single-agent and multi-agent capabilities. 
        Ask anything and get comprehensive, well-sourced answers.
      </p>
    </div>
    
    <div className="w-full mt-8 max-w-3xl">
      <InputForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onCancel={onCancel}
        hasHistory={false}
      />
    </div>
    
    <div className="flex items-center gap-2 text-sm text-neutral-400">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Powered by OpenAI, LangGraph, and advanced web research
    </div>
  </div>
);
