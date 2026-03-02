import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index.js';

type Step = 'create' | 'entity';

interface SelectedEntity {
  id: number;
  methodId: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AppState {
  step: Step;
  entity: SelectedEntity | null;
}

const initialState: AppState = {
  step: 'create',
  entity: null,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    entityCreated(state, action: PayloadAction<SelectedEntity>) {
      state.entity = action.payload;
      state.step = 'entity';
    },
    reset() {
      return initialState;
    },
  },
});

export const { entityCreated, reset } = appSlice.actions;

export const selectStep = (state: RootState) => state.app.step;
export const selectEntity = (state: RootState) => state.app.entity;
