import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components/common';
import type { GlobeNode } from '../../../components/charts/Globe360/Globe360';
import { GroupPicker } from '../../invitation_link/components/GroupPicker';
import { LinkCard } from '../../invitation_link/components/LinkCard';
import { CONSENT_NOTE, CONSENT_QUESTION, GROUP_LABEL } from '../../invitation_link/invitation.constants';
import type { InviteController } from '../useInviteController';
import { GlobeSwitch } from './GlobeSwitch';
import { GlobeSwitchSkeleton } from './Assessment360Skeleton';

export interface InvitePanelProps {
  controller: InviteController;
  nodes: GlobeNode[];
}

/** Công tắc bật/tắt đánh giá 360 kèm quả địa cầu, và quản lý các đường dẫn mời. Trả về các phần tử con của lưới trang. */
export const InvitePanel: React.FC<InvitePanelProps> = ({ controller, nodes }) => {
  const { state, isLoading, hasError, busy, locked } = controller;

  if (isLoading) {
    return (
      <div className="t360-wide">
        <GlobeSwitchSkeleton />
      </div>
    );
  }
  if (hasError || !state) {
    return (
      <div className="t360-wide">
        <Alert variant="danger">Không tải được dữ liệu mời đánh giá</Alert>
      </div>
    );
  }

  const hasResult = state.resultId !== null;
  const switchable = hasResult && !locked && !state.finalized;
  const enabled = switchable && state.consent === 'granted';

  return (
    <>
      <div className="t360-wide t360-notices">
        {!hasResult && (
          <Alert variant="info" title="Chưa có kết quả tự đánh giá">
            Hoàn thành bài tự đánh giá trước khi mời người khác.
            <div className="t360-alert-action">
              <Link to="/danh-gia-ca-nhan">
                <Button size="sm" rightIcon={<ArrowRight size={16} />}>
                  Làm bài đánh giá
                </Button>
              </Link>
            </div>
          </Alert>
        )}
        {hasResult && locked && (
          <Alert variant="warning" title="Chức năng mời đang bị khóa">
            Bạn dưới 16 tuổi và chưa có xác nhận của người giám hộ.
          </Alert>
        )}
        {hasResult && state.finalized && (
          <Alert variant="success" title="Kết quả đã được chốt">
            Không thể thêm người đánh giá cho kết quả này.
          </Alert>
        )}
        {controller.notice && <Alert variant="success">{controller.notice}</Alert>}
        {controller.actionError && <Alert variant="danger">{controller.actionError}</Alert>}
      </div>

      <div className="t360-wide">
        <GlobeSwitch
          checked={enabled}
          disabled={!switchable || busy}
          title="Cho phép người khác đánh giá"
          nodes={nodes}
          onToggle={controller.requestToggle}
        />
        {switchable && state.consent === 'declined' && <p className="t360-declined">Bạn đang không cho phép người khác đánh giá.</p>}
      </div>

      {enabled && (
        <section className="t360-invites" aria-labelledby="t360-invites-title">
          <h2 id="t360-invites-title" className="section-title">
            Đường dẫn mời
          </h2>
          {state.links.length > 0 && (
            <div className="t360-links">
              {state.links.map((link) => (
                <LinkCard key={link.id} link={link} disabled={busy} onRevoke={controller.setRevokeTarget} onRecreate={controller.recreate} />
              ))}
            </div>
          )}
          <GroupPicker
            takenGroups={state.links.map((l) => l.group)}
            selections={controller.selections}
            isSaving={busy}
            error={controller.pickerError}
            onChange={controller.setSelection}
            onCreate={controller.createLinks}
          />
        </section>
      )}

      <Modal
        open={controller.consentOpen}
        title="Mời người khác đánh giá"
        onClose={() => controller.setConsentOpen(false)}
        actions={
          <>
            <Button variant="outline" onClick={() => controller.answerConsent(false)}>
              Không đồng ý
            </Button>
            <Button onClick={() => controller.answerConsent(true)}>Đồng ý</Button>
          </>
        }
      >
        <p>
          <strong>{CONSENT_QUESTION}</strong>
        </p>
        <p>{CONSENT_NOTE}</p>
      </Modal>

      <Modal
        open={controller.revokeTarget !== null}
        title={`Thu hồi đường dẫn nhóm ${controller.revokeTarget ? GROUP_LABEL[controller.revokeTarget.group] : ''}`}
        onClose={() => controller.setRevokeTarget(null)}
        actions={
          <>
            <Button variant="outline" onClick={() => controller.setRevokeTarget(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={controller.revoke}>
              Thu hồi
            </Button>
          </>
        }
      >
        <p>Người đang giữ đường dẫn cũ sẽ không mở được bài nữa. Đường dẫn mới được tạo ngay cho nhóm này.</p>
      </Modal>

      <Modal
        open={controller.confirmOff}
        title="Tắt việc mời đánh giá"
        onClose={() => controller.setConfirmOff(false)}
        actions={
          <>
            <Button variant="outline" onClick={() => controller.setConfirmOff(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={controller.turnOff}>
              Tắt và thu hồi
            </Button>
          </>
        }
      >
        <p>Mọi đường dẫn đang mở sẽ bị thu hồi. Bài đã nộp vẫn được giữ lại.</p>
      </Modal>
    </>
  );
};
